"""Past observations for the logged-in faculty member."""

from flask import Blueprint, g, jsonify

from auth import faculty_required
from db import query

past_observations_bp = Blueprint("past_observations", __name__)

REPORT_FIELDS = (
    "content_clarity",
    "student_engagement",
    "openness_to_questions",
    "overall_comments",
    "tech_use",
    "slide_readability",
    "lecture_pace",
)


def _course_code(row):
    department = row["course_department"]
    number = row["course_number"]
    section = row["section_number"]
    if not department or not number:
        return None
    code = f"{department} {number}"
    return f"{code}.{section}" if section else code


def _date_text(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _record(row):
    record = {
        "meetingId": row["meeting_id"],
        "meetingDate": _date_text(row["meeting_date"]),
        "observeeId": row["observee_id"],
        "observeeName": row["observee_name"],
        "observerId": row["observer_id"],
        "observerName": row["observer_name"],
        "courseCode": _course_code(row),
        "courseName": row["course_name"],
        "semester": row["semester"],
        "reportExists": bool(row["report_exists"]),
    }
    for field in REPORT_FIELDS:
        record[field] = row[field]
    return record


@past_observations_bp.get("/api/my-observations")
@faculty_required
def get_my_observations():
    rows = query(
        """
        SELECT
            m.meeting_id,
            m.meeting_date,
            m.observer_id,
            observer.professor_name AS observer_name,
            c.prof_id AS observee_id,
            observee.professor_name AS observee_name,
            c.department AS course_department,
            c.course_number,
            c.section_number,
            c.course_name,
            c.semester,
            r.meeting_id IS NOT NULL AS report_exists,
            r.content_clarity,
            r.student_engagement,
            r.openness_to_questions,
            r.overall_comments,
            r.tech_use,
            r.slide_readability,
            r.lecture_pace
        FROM meetings m
        JOIN courses c ON c.course_id = m.course_id
        JOIN professors observee ON observee.professor_id = c.prof_id
        LEFT JOIN professors observer ON observer.professor_id = m.observer_id
        LEFT JOIN reports r ON r.meeting_id = m.meeting_id
        WHERE (c.prof_id = %s OR m.observer_id = %s)
          AND (
                r.meeting_id IS NOT NULL
                OR (m.meeting_date IS NOT NULL AND m.meeting_date < CURDATE())
          )
        ORDER BY m.meeting_date DESC, m.meeting_id DESC
        """,
        (g.user_id, g.user_id),
    )
    return jsonify(observations=[_record(row) for row in rows])
