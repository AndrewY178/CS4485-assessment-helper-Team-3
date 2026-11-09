"""The AC approves the observers an observee may send requests to.

API endpoint: "AC approve candidates"
    PUT /api/observers/approval?observee_id=...&signup_semester=...
        body: {"observer_ids": [1, 2, 3]}
    PUT /api/observers/reopen?observee_id=...&signup_semester=...
        takes an approved list back to "generated" (only before requests are sent)
        to regenerate the list for edits.
        
"""

from flask import Blueprint, jsonify, request

from api_helpers import error, json_body, transaction
from auth import ac_required

observer_approval_bp = Blueprint("observer_approval", __name__)

MAX_APPROVED_OBSERVERS = 5


def _signup_args():
    """(observee_id, signup_semester) from the query string, or None if missing or invalid."""
    signup_semester = request.args.get("signup_semester", "").strip()
    try:
        observee_id = int(request.args.get("observee_id", "").strip())
    except ValueError:
        return None
    return (observee_id, signup_semester) if signup_semester else None


def _parse_observer_ids(raw_ids):
    """Unique observer ids as ints, or None if the list is invalid."""
    if not isinstance(raw_ids, list) or not raw_ids:
        return None
    parsed = []
    for raw in raw_ids:
        if isinstance(raw, bool):
            return None
        try:
            parsed.append(int(raw))
        except (TypeError, ValueError):
            return None
    return list(dict.fromkeys(parsed))


def _wrong_status_message(status):
    if status == "approved":
        return "This observer list was already approved"
    if status == "not_generated":
        return "The observer list has not been generated yet"
    if status == "no_observers":
        return "No observers were found for this observee"
    return f"The observer list can't be approved while the sign-up status is '{status}'"


@observer_approval_bp.put("/api/observers/approval")
@ac_required
def approve_observers():
    args = _signup_args()
    if args is None:
        return error("observee_id and signup_semester are required", 400)
    observee_id, signup_semester = args

    observer_ids = _parse_observer_ids(json_body().get("observer_ids"))
    if observer_ids is None:
        return error("observer_ids must be a list of observer ids", 400)
    if len(observer_ids) > MAX_APPROVED_OBSERVERS:
        return error(f"Approve at most {MAX_APPROVED_OBSERVERS} observers", 400)

    with transaction() as cur:
        # lock the sign-up so two approvals at once can't both go through
        cur.execute(
            """
            SELECT status, signup_course
            FROM observees
            WHERE observee_id = %s AND signup_sem = %s
            FOR UPDATE
            """,
            (observee_id, signup_semester),
        )
        signup = cur.fetchone()
        if not signup:
            return error("Observee sign-up was not found", 404)
        if signup["status"] != "generated":
            return error(_wrong_status_message(signup["status"]), 409)

        cur.execute(
            "SELECT meeting_id FROM meetings WHERE course_id = %s ORDER BY meeting_id LIMIT 1",
            (signup["signup_course"],),
        )
        meeting = cur.fetchone()
        if not meeting:
            return error("Observee does not have a meeting", 409)
        meeting_id = meeting["meeting_id"]

        cur.execute(
            """
            SELECT observer_id
            FROM observation_requests
            WHERE meeting_id = %s AND status = 'generated'
            FOR UPDATE
            """,
            (meeting_id,),
        )
        generated = {row["observer_id"] for row in cur.fetchall()}
        not_candidates = [i for i in observer_ids if i not in generated]
        if not_candidates:
            return error(
                "These observers are not generated candidates for this observee: "
                + ", ".join(str(i) for i in not_candidates),
                400,
            )

        placeholders = ", ".join(["%s"] * len(observer_ids))
        cur.execute(
            f"""
            UPDATE observation_requests
            SET status = 'approved'
            WHERE meeting_id = %s AND status = 'generated'
              AND observer_id IN ({placeholders})
            """,
            (meeting_id, *observer_ids),
        )
        # whatever is still 'generated' is what the AC did not approve
        cur.execute(
            "DELETE FROM observation_requests WHERE meeting_id = %s AND status = 'generated'",
            (meeting_id,),
        )
        removed = cur.rowcount
        cur.execute(
            "UPDATE observees SET status = 'approved' WHERE observee_id = %s AND signup_sem = %s",
            (observee_id, signup_semester),
        )

    return jsonify(
        observee_id=observee_id,
        signup_semester=signup_semester,
        meeting_id=meeting_id,
        approved=sorted(observer_ids),
        removed=removed,
    )


@observer_approval_bp.put("/api/observers/reopen")
@ac_required
def reopen_observer_list():
    args = _signup_args()
    if args is None:
        return error("observee_id and signup_semester are required", 400)
    observee_id, signup_semester = args

    with transaction() as cur:
        cur.execute(
            """
            SELECT status, signup_course
            FROM observees
            WHERE observee_id = %s AND signup_sem = %s
            FOR UPDATE
            """,
            (observee_id, signup_semester),
        )
        signup = cur.fetchone()
        if not signup:
            return error("Observee sign-up was not found", 404)
        if signup["status"] != "approved":
            return error("Only an approved observer list can be reopened", 409)

        cur.execute(
            "SELECT meeting_id FROM meetings WHERE course_id = %s ORDER BY meeting_id LIMIT 1",
            (signup["signup_course"],),
        )
        meeting = cur.fetchone()
        if not meeting:
            return error("Observee does not have a meeting", 409)
        meeting_id = meeting["meeting_id"]

        cur.execute(
            "SELECT observer_id, status FROM observation_requests WHERE meeting_id = %s FOR UPDATE",
            (meeting_id,),
        )
        requests = cur.fetchall()
        if any(row["status"] != "approved" for row in requests):
            return error("Requests were already sent, so the list can't be reopened", 409)

        cur.execute("DELETE FROM observation_requests WHERE meeting_id = %s", (meeting_id,))
        cur.execute(
            "UPDATE observees SET status = 'generated' WHERE observee_id = %s AND signup_sem = %s",
            (observee_id, signup_semester),
        )

    return jsonify(
        observee_id=observee_id,
        signup_semester=signup_semester,
        meeting_id=meeting_id,
        previously_approved=sorted(row["observer_id"] for row in requests),
    )
