"""Faculty evaluation status and observation history."""

from flask import Blueprint, g, jsonify

from api_helpers import error
from auth import faculty_required
from current_semester import semester_for_date
from db import query

faculty_status_bp = Blueprint("faculty_status", __name__)


def _semester_rank(semester):
    parts = (semester or "").split()
    if len(parts) != 2:
        return (0, 0)
    terms = {"Spring": 1, "Summer": 2, "Fall": 3}
    try:
        return (int(parts[1]), terms.get(parts[0], 0))
    except ValueError:
        return (0, 0)


def _course_code(row):
    if not row["course_department"] or not row["course_number"]:
        return None
    code = f'{row["course_department"]} {row["course_number"]}'
    return f'{code}.{row["section_number"]}' if row["section_number"] else code


def _iso_datetime(value):
    return value.isoformat() if value is not None else None


@faculty_status_bp.get("/api/faculty/status")
@faculty_required
def get_faculty_status():
    current_semester = semester_for_date()
    if current_semester is None:
        return error("Current date is outside the supported Spring and Fall semesters", 422)

    cycle_rows = query(
        """
        SELECT signup_deadline, observation_deadline
        FROM evaluation_cycles
        WHERE semester = %s
        """,
        (current_semester,),
    )
    if not cycle_rows:
        return error(f"No evaluation cycle is configured for {current_semester}", 404)
    cycle = cycle_rows[0]

    professors = query(
        """
        SELECT professor_rank, last_sem_observed
        FROM professors
        WHERE professor_id = %s
        """,
        (g.user_id,),
    )
    if not professors:
        return error("Faculty profile was not found", 404)

    current_rank = _semester_rank(current_semester)
    history = query(
        """
        SELECT
            o.signup_sem,
            c.department AS course_department,
            c.course_number,
            c.section_number,
            c.course_name
        FROM observees o
        LEFT JOIN courses c ON c.course_id = o.signup_course
        WHERE o.observee_id = %s
          AND (
              CAST(SUBSTRING_INDEX(o.signup_sem, ' ', -1) AS UNSIGNED) < %s
              OR (
                  CAST(SUBSTRING_INDEX(o.signup_sem, ' ', -1) AS UNSIGNED) = %s
                  AND FIELD(SUBSTRING_INDEX(o.signup_sem, ' ', 1), 'Spring', 'Summer', 'Fall')
                      < FIELD(SUBSTRING_INDEX(%s, ' ', 1), 'Spring', 'Summer', 'Fall')
              )
          )
        ORDER BY
            CAST(SUBSTRING_INDEX(o.signup_sem, ' ', -1) AS UNSIGNED) DESC,
            FIELD(SUBSTRING_INDEX(o.signup_sem, ' ', 1), 'Spring', 'Summer', 'Fall') DESC
        """,
        (g.user_id, current_rank[0], current_rank[0], current_semester),
    )

    return jsonify(
        semester=current_semester,
        signupDeadline=_iso_datetime(cycle["signup_deadline"]),
        observationDeadline=_iso_datetime(cycle["observation_deadline"]),
        professorRank=professors[0]["professor_rank"],
        lastSemesterObserved=professors[0]["last_sem_observed"],
        pastObservations=[
            {
                "semester": row["signup_sem"],
                "courseCode": _course_code(row),
                "courseName": row["course_name"],
            }
            for row in history
        ],
    )
