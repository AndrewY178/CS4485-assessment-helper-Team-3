"""Faculty feedback survey endpoints."""

from flask import Blueprint, g, jsonify, request

from api_helpers import error, json_body
from auth import _roles_for, ac_required, faculty_required, login_required
from db import query
from deadlines import deadline_block

feedback_bp = Blueprint("feedback", __name__)

SEMESTER_ROLES = {"observee", "observer", "both"}
PROCESS_RATINGS = {"yes", "mostly", "no"}


@feedback_bp.put("/api/feedback")
@faculty_required
def save_feedback():
    body = json_body()
    semester = body.get("semester")
    if not isinstance(semester, str) or not semester.strip():
        return error("semester is required", 400)
    semester = semester.strip()
    blocked = deadline_block("submit_feedback", semester)
    if blocked:
        return blocked

    semester_role = body.get("semester_role", "observee")
    if not isinstance(semester_role, str) or semester_role not in SEMESTER_ROLES:
        return error("semester_role must be observee, observer, or both", 400)

    process_ok = body.get("process_OK")
    if not isinstance(process_ok, str) or process_ok not in PROCESS_RATINGS:
        return error("process_OK must be yes, mostly, or no", 400)

    difficulties = body.get("difficulties")
    improvements = body.get("improvements")
    if difficulties is not None and not isinstance(difficulties, str):
        return error("difficulties must be a string or null", 400)
    if improvements is not None and not isinstance(improvements, str):
        return error("improvements must be a string or null", 400)

    query(
        """
        INSERT INTO feedback (
            semester, professor_id, semester_role, process_OK,
            difficulties, improvements
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            semester_role = VALUES(semester_role),
            process_OK = VALUES(process_OK),
            difficulties = VALUES(difficulties),
            improvements = VALUES(improvements)
        """,
        (
            semester,
            g.user_id,
            semester_role,
            process_ok,
            difficulties,
            improvements,
        ),
        fetch=False,
    )
    return jsonify(
        semester=semester,
        observee_id=g.user_id,
        semester_role=semester_role,
        process_OK=process_ok,
        difficulties=difficulties,
        improvements=improvements,
    )


@feedback_bp.get("/api/feedback")
@login_required
def get_feedback():
    semester = request.args.get("semester", "").strip()
    raw_observee_id = request.args.get("observee_id", "").strip()
    if not semester or not raw_observee_id:
        return error("semester and observee_id are required", 400)
    try:
        observee_id = int(raw_observee_id)
    except ValueError:
        return error("observee_id must be an integer", 400)

    roles = _roles_for(g.user_id)
    if observee_id != g.user_id and "AC Member" not in roles:
        return error("You may only view your own feedback", 403)
    if observee_id == g.user_id and not ({"Faculty", "AC Member"} & set(roles)):
        return error("Faculty only", 403)

    rows = query(
        """
        SELECT semester, professor_id AS observee_id, semester_role,
               process_OK, difficulties, improvements
        FROM feedback
        WHERE semester = %s AND professor_id = %s
        """,
        (semester, observee_id),
    )
    if not rows:
        return error("Feedback not found", 404)
    return jsonify(rows[0])


@feedback_bp.get("/api/feedback/breakdown")
@ac_required
def get_feedback_breakdown():
    semester = request.args.get("semester", "").strip()
    if not semester:
        return error("semester is required", 400)

    rows = query(
        """
        SELECT
            COALESCE(SUM(process_OK = 'yes'), 0) AS yes,
            COALESCE(SUM(process_OK = 'mostly'), 0) AS mostly,
            COALESCE(SUM(process_OK = 'no'), 0) AS no
        FROM feedback
        WHERE semester = %s
        """,
        (semester,),
    )
    counts = rows[0] or {}
    return jsonify(
        semester=semester,
        counts={
            "yes": int(counts.get("yes") or 0),
            "mostly": int(counts.get("mostly") or 0),
            "no": int(counts.get("no") or 0),
        },
    )
