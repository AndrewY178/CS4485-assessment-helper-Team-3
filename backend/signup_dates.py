"""Dates an observee offers for their observation when they sign up.

API endpoints:
    PUT /api/signup-dates                      save the dates (and create the meeting if missing)
    GET /api/signup-dates?signup_semester=...  to read the saved dates back
"""

from datetime import date

from flask import Blueprint, g, jsonify, request

from api_helpers import error, json_body, transaction
from auth import faculty_required

signup_dates_bp = Blueprint("signup_dates", __name__)

# observation_requests statuses that mean a request has already gone out to an observer
SENT_STATUSES = ("pending", "accepted", "declined", "confirmed", "not_selected", "expired")


def _parse_dates(raw_dates):
    """Offered dates as a sorted list of unique future dates, or None if the list is invalid."""
    if not isinstance(raw_dates, list) or not raw_dates:
        return None
    parsed = set()
    for raw in raw_dates:
        try:
            parsed.add(date.fromisoformat(raw))
        except (TypeError, ValueError):
            return None
    if any(d <= date.today() for d in parsed):
        return None
    return sorted(parsed)


def _offered_dates(cursor, observee_id, signup_semester):
    cursor.execute(
        """
        SELECT offered_date
        FROM signup_dates
        WHERE observee_id = %s AND signup_sem = %s
        ORDER BY offered_date
        """,
        (observee_id, signup_semester),
    )
    return [row["offered_date"].isoformat() for row in cursor.fetchall()]


def _meeting_id(cursor, course_id):
    cursor.execute(
        "SELECT meeting_id FROM meetings WHERE course_id = %s ORDER BY meeting_id LIMIT 1",
        (course_id,),
    )
    row = cursor.fetchone()
    return row["meeting_id"] if row else None


@signup_dates_bp.get("/api/signup-dates")
@faculty_required
def get_signup_dates():
    signup_semester = request.args.get("signup_semester", "").strip()
    if not signup_semester:
        return error("signup_semester is required", 400)

    with transaction() as cur:
        cur.execute(
            "SELECT signup_course FROM observees WHERE observee_id = %s AND signup_sem = %s",
            (g.user_id, signup_semester),
        )
        signup = cur.fetchone()
        if not signup:
            return error("No sign-up found for this semester", 404)
        meeting_id = (
            _meeting_id(cur, signup["signup_course"]) if signup["signup_course"] else None
        )
        dates = _offered_dates(cur, g.user_id, signup_semester)

    return jsonify(
        signup_semester=signup_semester,
        course_id=signup["signup_course"],
        meeting_id=meeting_id,
        dates=dates,
    )


@signup_dates_bp.put("/api/signup-dates")
@faculty_required
def save_signup_dates():
    body = json_body()
    signup_semester = str(body.get("signup_semester") or "").strip()
    if not signup_semester:
        return error("signup_semester is required", 400)
    dates = _parse_dates(body.get("dates"))
    if dates is None:
        return error("dates must be a list of future dates", 400)
    raw_course_id = body.get("course_id")
    try:
        course_id = int(raw_course_id)
    except (TypeError, ValueError):
        return error("course_id must be an integer", 400)
    if course_id <= 0:
        return error("course_id must be an integer", 400)

    with transaction() as cur:
        cur.execute(
            """
            SELECT course_id
            FROM courses
            WHERE course_id = %s AND prof_id = %s AND semester = %s
            """,
            (course_id, g.user_id, signup_semester),
        )
        if not cur.fetchone():
            return error("The selected course is not taught by you this semester", 422)

        # lock the sign-up so two saves at once can't create two meetings
        cur.execute(
            """
            SELECT signup_course
            FROM observees
            WHERE observee_id = %s AND signup_sem = %s
            FOR UPDATE
            """,
            (g.user_id, signup_semester),
        )
        signup = cur.fetchone()
        if not signup:
            cur.execute(
                """
                INSERT INTO observees (observee_id, signup_sem, signup_course)
                VALUES (%s, %s, %s)
                """,
                (g.user_id, signup_semester, course_id),
            )
            previous_course_id = None
        else:
            previous_course_id = signup["signup_course"]
            if previous_course_id != course_id:
                cur.execute(
                    """
                    SELECT 1
                    FROM meetings m
                    JOIN observation_requests r ON r.meeting_id = m.meeting_id
                    WHERE m.course_id = %s AND r.status IN (%s, %s, %s, %s, %s, %s)
                    LIMIT 1
                    """,
                    (previous_course_id, *SENT_STATUSES),
                )
                if cur.fetchone():
                    return error(
                        "Requests have already been sent, so the course can't be changed",
                        409,
                    )
                cur.execute(
                    """
                    UPDATE observees
                    SET signup_course = %s
                    WHERE observee_id = %s AND signup_sem = %s
                    """,
                    (course_id, g.user_id, signup_semester),
                )

        # the meeting has no observer or date until the observee confirms one
        meeting_id = _meeting_id(cur, previous_course_id) if previous_course_id else None
        if meeting_id is None:
            cur.execute("INSERT INTO meetings (course_id) VALUES (%s)", (course_id,))
            meeting_id = cur.lastrowid
        else:
            if previous_course_id != course_id:
                cur.execute(
                    "UPDATE meetings SET course_id = %s WHERE meeting_id = %s",
                    (course_id, meeting_id),
                )
            placeholders = ", ".join(["%s"] * len(SENT_STATUSES))
            cur.execute(
                f"""
                SELECT 1
                FROM observation_requests
                WHERE meeting_id = %s AND status IN ({placeholders})
                LIMIT 1
                """,
                (meeting_id, *SENT_STATUSES),
            )
            if cur.fetchone():
                return error(
                    "Requests have already been sent, so the offered dates can't be changed",
                    409,
                )

        cur.execute(
            "DELETE FROM signup_dates WHERE observee_id = %s AND signup_sem = %s",
            (g.user_id, signup_semester),
        )
        cur.executemany(
            "INSERT INTO signup_dates (observee_id, signup_sem, offered_date) VALUES (%s, %s, %s)",
            [(g.user_id, signup_semester, d) for d in dates],
        )
        saved = _offered_dates(cur, g.user_id, signup_semester)

    return jsonify(
        signup_semester=signup_semester,
        course_id=course_id,
        meeting_id=meeting_id,
        dates=saved,
    )
