"""Faculty feedback survey endpoints."""

from flask import Blueprint, g, jsonify, request

from api_helpers import error, json_body
from auth import _roles_for, ac_required, faculty_required, login_required
from db import query
from deadlines import check_deadline, cycle_deadline_times, deadline_problem

feedback_bp = Blueprint("feedback", __name__)

SEMESTER_ROLES = {"observee", "observer", "both"}
PROCESS_RATINGS = {"yes", "mostly", "no"}


def _has_submitted_observation_form(user_id, semester):
    """True if this professor, as an observer, has signed (submitted) an observation form this semester."""
    rows = query(
        """
        SELECT 1
        FROM evaluations e
        JOIN meetings m ON m.meeting_id = e.meeting_id
        JOIN courses c ON c.course_id = m.course_id
        WHERE m.observer_id = %s
          AND c.semester = %s
          AND e.observer_signed_at IS NOT NULL
        LIMIT 1
        """,
        (user_id, semester),
    )
    return bool(rows)


def survey_problem(semester):
    """Why the current user can't edit the survey right now (a dict with "message"), or None if they can.

    Open until the feedback deadline. Before the observation deadline it is open only to an
    observer who has already submitted their observation form; after it, to everyone.
    """
    problem = deadline_problem("submit_feedback", semester)
    if problem:
        return problem
    if deadline_problem("survey_open_to_all", semester) is None:
        return None
    if _has_submitted_observation_form(g.user_id, semester):
        return None
    early = check_deadline("survey_open_to_all", semester)
    return {
        **early,
        "message": (
            "The survey opens once you submit your observation form, or when the "
            f"observation deadline passes. {early['message']}"
        ),
    }


@feedback_bp.put("/api/feedback")
@faculty_required
def save_feedback():
    body = json_body()
    semester = body.get("semester")
    if not isinstance(semester, str) or not semester.strip():
        return error("semester is required", 400)
    semester = semester.strip()
    problem = survey_problem(semester)
    if problem:
        return (
            jsonify(
                error=problem["message"],
                deadline=problem["deadline"],
                rule=problem["rule"],
                at=problem["at"],
            ),
            403,
        )

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


@feedback_bp.get("/api/feedback/status")
@faculty_required
def get_feedback_status():
    """Whether the survey can be edited right now, so the screen can be read-only outside the window."""
    semester = request.args.get("semester", "").strip()
    if not semester:
        return error("semester is required", 400)
    problem = survey_problem(semester)
    times = cycle_deadline_times(semester)
    return jsonify(
        semester=semester,
        open=problem is None,
        message=problem["message"] if problem else None,
        observationDeadline=times["observation_deadline"],
        feedbackDeadline=times["feedback_deadline"],
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
