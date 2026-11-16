from pathlib import Path
import json
import time
from contextlib import contextmanager
from datetime import date

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from mysql.connector import Error, IntegrityError
from dotenv import load_dotenv
from auth import ac_required, auth_bp, faculty_required
from reminders import reminders_bp
from signup_dates import signup_dates_bp
from observer_approval import observer_approval_bp
from feedback import feedback_bp
from notifications import (
    insert_notifications,
    notifications_bp,
    send_notification_email,
)

from db import query, pool, transaction
from datetime import datetime, timezone

EMAILJS_RATE_LIMIT_SECONDS = 1.1

# use the .env at the repo root 
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
CORS(app)
app.register_blueprint(auth_bp)
app.register_blueprint(reminders_bp)
app.register_blueprint(signup_dates_bp)
app.register_blueprint(observer_approval_bp)
app.register_blueprint(feedback_bp)
app.register_blueprint(notifications_bp)

# SQL statements
PROFESSOR_SELECT = f"""
    SELECT
        p.professor_id AS id,
        p.professor_name AS name,
        u.username,
        p.professor_rank AS prof_rank,
        p.professor_department AS department,
        p.last_sem_observed,
        o.hiring_sem,
        ac.ac_id IS NOT NULL AS is_ac_member
    FROM professors AS p
    JOIN users u ON u.id = p.professor_id
    LEFT JOIN observees o ON o.observee_id = p.professor_id
    LEFT JOIN assessment_committee ac ON ac.ac_id = p.professor_id
"""
OBSERVEE_SELECT = f"""
    SELECT
        p.professor_id AS id,
        p.professor_name AS name,
        u.username,
        u.email,
        p.professor_rank AS prof_rank,
        p.professor_department AS department,
        p.last_sem_observed,
        o.hiring_sem,
        o.signup_sem,
        o.status,
        c.course_id,
        c.department AS course_department,
        c.course_number,
        c.section_number,
        c.course_name,
        c.course_day,
        c.course_start_time,
        c.course_end_time,
        ac.ac_id IS NOT NULL AS is_ac_member
    FROM professors AS p
    JOIN users u ON u.id = p.professor_id
    JOIN observees o ON o.observee_id = p.professor_id
    LEFT JOIN courses c ON c.course_id = o.signup_course
    LEFT JOIN assessment_committee ac ON ac.ac_id = p.professor_id
"""
OBSERVER_CANDIDATES_SELECT = """
WITH selected_observee AS (
    SELECT
        o.observee_id,
        o.signup_sem,
        c.department,
        c.semester,
        c.course_day,
        c.course_start_time,
        c.course_end_time,
        CONCAT(SUBSTRING(c.course_number, 1, 1), '000') AS course_level
    FROM observees o
    JOIN courses c ON c.course_id = o.signup_course
    WHERE o.observee_id = %s
      AND o.signup_sem = %s
)
SELECT DISTINCT
    p.professor_id AS observer_id,
    p.professor_name,
    p.professor_department,
    0 AS currentObservationCount
FROM selected_observee s
JOIN courses matching
    ON matching.semester = s.semester
   AND matching.department = s.department
   AND CONCAT(SUBSTRING(matching.course_number, 1, 1), '000')
       = s.course_level
JOIN observees o
    ON o.observee_id = matching.prof_id
JOIN professors p
    ON p.professor_id = o.observee_id
WHERE o.observee_id <> s.observee_id
AND o.signup_sem = s.semester
  AND NOT EXISTS (
      SELECT 1
      FROM courses busy
      WHERE busy.prof_id = o.observee_id
        AND busy.semester = s.semester
        AND (
            (INSTR(s.course_day, 'M') > 0 AND INSTR(busy.course_day, 'M') > 0)
         OR (INSTR(s.course_day, 'T') > 0 AND INSTR(busy.course_day, 'T') > 0)
         OR (INSTR(s.course_day, 'W') > 0 AND INSTR(busy.course_day, 'W') > 0)
         OR (INSTR(s.course_day, 'R') > 0 AND INSTR(busy.course_day, 'R') > 0)
         OR (INSTR(s.course_day, 'F') > 0 AND INSTR(busy.course_day, 'F') > 0)
        )
        AND busy.course_start_time < s.course_end_time
        AND busy.course_end_time > s.course_start_time
LIMIT 5
  )
"""
COURSE_SELECT = f"""
    SELECT *
    FROM courses c
"""

CYCLE_SELECT = """
    SELECT
        semester,
        cycle_status,
        signup_deadline,
        observation_deadline,
        feedback_deadline,
        updated_at
    FROM evaluation_cycles
"""

CYCLE_UPSERT = """
    INSERT INTO evaluation_cycles (
        semester,
        cycle_status,
        signup_deadline,
        observation_deadline,
        feedback_deadline
    ) 
    VALUES (%s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        signup_deadline = VALUES(signup_deadline),
        observation_deadline = VALUES(observation_deadline),
        feedback_deadline = VALUES(feedback_deadline)
"""
TRACKING_SELECT = """
    SELECT
        o.observee_id,
        p.professor_name AS observee_name,
        o.signup_sem,
        c.course_id,
        c.department AS course_department,
        c.course_number,
        c.section_number,
        c.course_name,
        m.meeting_id,
        m.meeting_date,
        m.observer_id,
        observer.professor_name AS observer_name,
        CASE WHEN r.meeting_id IS NULL THEN 0 ELSE 1 END AS report_exists,
        COALESCE(requests.total_count, 0) AS request_total,
        COALESCE(requests.approved_count, 0) AS approved_count,
        COALESCE(requests.pending_count, 0) AS pending_count,
        COALESCE(requests.accepted_count, 0) AS accepted_count,
        COALESCE(requests.declined_count, 0) AS declined_count,
        COALESCE(requests.confirmed_count, 0) AS confirmed_count,
        COALESCE(requests.not_selected_count, 0) AS not_selected_count,
        COALESCE(requests.expired_count, 0) AS expired_count
    FROM observees o
    JOIN professors p ON p.professor_id = o.observee_id
    LEFT JOIN courses c ON c.course_id = o.signup_course
    LEFT JOIN meetings m ON m.course_id = o.signup_course
    LEFT JOIN professors observer ON observer.professor_id = m.observer_id
    LEFT JOIN reports r ON r.meeting_id = m.meeting_id
    LEFT JOIN (
        SELECT
            meeting_id,
            COUNT(*) AS total_count,
            SUM(status = 'approved') AS approved_count,
            SUM(
                status = 'pending'
                AND (sent_at IS NULL OR sent_at >= NOW() - INTERVAL 48 HOUR)
            ) AS pending_count,
            SUM(status = 'accepted') AS accepted_count,
            SUM(status = 'declined') AS declined_count,
            SUM(status = 'confirmed') AS confirmed_count,
            SUM(status = 'not_selected') AS not_selected_count,
            SUM(
                status = 'expired'
                OR (status = 'pending' AND sent_at < NOW() - INTERVAL 48 HOUR)
            ) AS expired_count
        FROM observation_requests
        GROUP BY meeting_id
    ) requests ON requests.meeting_id = m.meeting_id
    WHERE o.signup_sem = %s
    ORDER BY p.professor_name, m.meeting_id
"""
FACULTY_SCHEDULE_CONDUCTING_SELECT = """
    SELECT
        m.meeting_id,
        m.meeting_date,
        c.department AS course_department,
        c.course_number,
        c.section_number,
        c.course_name,
        observee.professor_name AS counterpart_name,
        CASE WHEN r.meeting_id IS NULL THEN 0 ELSE 1 END AS report_exists
    FROM meetings m
    JOIN courses c ON c.course_id = m.course_id
    JOIN professors observee ON observee.professor_id = c.prof_id
    LEFT JOIN reports r ON r.meeting_id = m.meeting_id
    WHERE m.observer_id = %s
      AND c.semester = %s
      AND m.observer_id IS NOT NULL
      AND m.meeting_date IS NOT NULL
    ORDER BY m.meeting_date, m.meeting_id
"""
FACULTY_SCHEDULE_OBSERVEE_SELECT = """
    SELECT
        m.meeting_id,
        m.meeting_date,
        c.department AS course_department,
        c.course_number,
        c.section_number,
        c.course_name,
        observer.professor_name AS counterpart_name,
        CASE WHEN r.meeting_id IS NULL THEN 0 ELSE 1 END AS report_exists
    FROM meetings m
    JOIN courses c ON c.course_id = m.course_id
    JOIN professors observer ON observer.professor_id = m.observer_id
    LEFT JOIN reports r ON r.meeting_id = m.meeting_id
    WHERE c.prof_id = %s
      AND c.semester = %s
      AND m.observer_id IS NOT NULL
      AND m.meeting_date IS NOT NULL
    ORDER BY m.meeting_date, m.meeting_id
"""


def tracking_status(row):
    if row["report_exists"]:
        return "completed"

    meeting_date = row["meeting_date"]
    if row["observer_id"] is not None and meeting_date is not None:
        # The database currently stores only a date, not an observation time.
        # Keep today's observation scheduled until the following day.
        if meeting_date < date.today():
            return "report-pending"
        return "scheduled"

    request_total = int(row["request_total"] or 0)
    unsuccessful_requests = int(row["declined_count"] or 0) + int(
        row["expired_count"] or 0
    )
    if request_total > 0 and unsuccessful_requests == request_total:
        return "needs-attention"
    return "observer-needed"


def course_code(row):
    department = row["course_department"]
    number = row["course_number"]
    section = row["section_number"]
    if not department or not number:
        return None

    code = f"{department} {number}"
    return f"{code}.{section}" if section else code


def tracking_record(row):
    meeting_date = row["meeting_date"]
    if meeting_date is not None:
        meeting_date = meeting_date.isoformat()

    return {
        "observeeId": row["observee_id"],
        "observeeName": row["observee_name"],
        "courseId": row["course_id"],
        "courseCode": course_code(row),
        "courseName": row["course_name"],
        "meetingId": row["meeting_id"],
        "meetingDate": meeting_date,
        "observerId": row["observer_id"],
        "observerName": row["observer_name"],
        "requestCounts": {
            "approved": int(row["approved_count"] or 0),
            "pending": int(row["pending_count"] or 0),
            "accepted": int(row["accepted_count"] or 0),
            "declined": int(row["declined_count"] or 0),
            "confirmed": int(row["confirmed_count"] or 0),
            "notSelected": int(row["not_selected_count"] or 0),
            "expired": int(row["expired_count"] or 0),
        },
        "reportExists": bool(row["report_exists"]),
        "status": tracking_status(row),
    }


def faculty_schedule_status(row):
    if row["report_exists"]:
        return "Completed"
    if row["meeting_date"] < date.today():
        return "Report Pending"
    return "Scheduled"


def faculty_schedule_record(row):
    return {
        "id": str(row["meeting_id"]),
        "observationDate": row["meeting_date"].isoformat(),
        "course": {
            "code": course_code(row),
            "title": row["course_name"],
        },
        "counterpartName": row["counterpart_name"],
        "status": faculty_schedule_status(row),
    }


class ObserverListLocked(ValueError):
    """The list can't be regenerated because requests already went past 'generated'."""


def generate_observer_list(observee_id, signup_semester):
    selected = query(
        """
        SELECT o.observee_id, o.signup_sem, o.signup_course,
               c.semester, c.course_day, c.course_start_time, c.course_end_time,
               m.meeting_id
        FROM observees o
        LEFT JOIN courses c ON c.course_id = o.signup_course
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        WHERE o.observee_id = %s AND o.signup_sem = %s
        """,
        (observee_id, signup_semester),
    )

    if not selected:
        raise ValueError("Observee was not found for the signup semester")

        

    course = selected[0]
    if course["semester"] != signup_semester:
        raise ValueError("Signup semester does not match course semester")

    if course["meeting_id"] == None:
        raise ValueError("Observee does not have a meeting")



    if not all((
        course["signup_course"],
        course["course_day"],
        course["course_start_time"],
        course["course_end_time"],
    )):
        raise ValueError("Observee has incomplete signup course information")

    candidates = query(
        OBSERVER_CANDIDATES_SELECT,
        (observee_id, signup_semester),
    )

    def replace_rows(cursor):
        # once the AC approved the list (or requests were sent) it is no longer regenerated
        cursor.execute(
            """
            SELECT 1
            FROM observation_requests
            WHERE meeting_id = %s AND status <> 'generated'
            LIMIT 1
            """,
            (course["meeting_id"],),
        )
        if cursor.fetchone():
            raise ObserverListLocked(
                "The observer list was already approved or requests were sent"
            )
        # delete all the old generated observers if regenerating
        cursor.execute(
            """
            DELETE FROM observation_requests
            WHERE meeting_id = %s AND status = 'generated'
            """,
            (course["meeting_id"],),
        )
        # insert the candidates into observation_requests with generated status
        if candidates:
            cursor.executemany(
                """
                INSERT INTO observation_requests
                    (meeting_id, observer_id, status)
                VALUES (%s, %s, 'generated')
                """,
                [
                    (course["meeting_id"], candidate["observer_id"])
                    for candidate in candidates
                ],
            )
        if len(candidates) == 0:
            status = 'no_observers'
        else:
            status = 'generated'
        cursor.execute(
            """
            UPDATE observees
            SET status = %s
            WHERE observee_id = %s
            AND signup_sem = %s
            """,
            (status, observee_id, signup_semester)
        )

        

    transaction(replace_rows)
    return candidates

# AC Member GET endpoints
@app.route("/api/users")
def get_users():
    rows = query(PROFESSOR_SELECT + " ORDER BY p.professor_name")
    return jsonify(rows)


# need to get everything from user, plus signup sem, course id,
# course dep, course number, course section, course day, course starttime
@app.route("/api/observees")
def get_observees():
    signup_semester = request.args.get("signup_semester", "").strip()

    if not signup_semester:
        semesters = query(
            """
            SELECT signup_sem
            FROM observees
            WHERE signup_sem IS NOT NULL
            GROUP BY signup_sem
            ORDER BY
                CAST(SUBSTRING_INDEX(signup_sem, ' ', -1) AS UNSIGNED) DESC,
                FIELD(SUBSTRING_INDEX(signup_sem, ' ', 1), 'Spring', 'Summer', 'Fall') DESC
            LIMIT 1
            """
        )
        if not semesters:
            return jsonify([])
        signup_semester = semesters[0]["signup_sem"]

    rows = query(
        OBSERVEE_SELECT
        + " WHERE o.signup_sem = %s ORDER BY p.professor_name",
        (signup_semester,),
    )
    return jsonify(rows)

# TODO: need this to return the list of observers from the observation request table that are for the inputted observee_id and signup_semester
@app.route("/api/observers")
def get_observe_list():
    raw_observee_id = request.args.get("observee_id", "").strip()
    signup_semester = request.args.get("signup_semester", "").strip()

    if not raw_observee_id or not signup_semester:
        return jsonify(error="observee_id and signup_semester are required"), 400

    try:
        observee_id = int(raw_observee_id)
    except ValueError:
        return jsonify(error="observee_id must be an integer"), 400

    selected = query(
        """
        SELECT m.meeting_id
        FROM observees o
        LEFT JOIN courses c ON c.course_id = o.signup_course
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        WHERE o.observee_id = %s AND o.signup_sem = %s
        """,
        (observee_id, signup_semester),
    )

    if not selected or selected[0]["meeting_id"] is None:
        return jsonify([])

    observers = query(
        """
        SELECT DISTINCT
            ob_r.observer_id,
            p.professor_name,
            p.professor_department,
            ob_r.status,
            ob_r.selected_date,
            0 AS currentObservationCount
        FROM observation_requests ob_r
        JOIN professors p ON p.professor_id = ob_r.observer_id
        WHERE ob_r.meeting_id = %s
        """,
        (selected[0]["meeting_id"],)
    )

    for row in observers:
        if row["selected_date"] is not None:
            row["selected_date"] = row["selected_date"].isoformat()

    return jsonify(observers)


@app.route("/api/observers/accepted")
def get_accepted_observers():
    raw_observee_id = request.args.get("observee_id", "").strip()
    signup_semester = request.args.get("signup_semester", "").strip()

    if not raw_observee_id or not signup_semester:
        return jsonify(error="observee_id and signup_semester are required"), 400

    try:
        observee_id = int(raw_observee_id)
    except ValueError:
        return jsonify(error="observee_id must be an integer"), 400

    selected = query(
        """
        SELECT m.meeting_id
        FROM observees o
        LEFT JOIN courses c ON c.course_id = o.signup_course
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        WHERE o.observee_id = %s AND o.signup_sem = %s
        """,
        (observee_id, signup_semester),
    )

    if not selected or selected[0]["meeting_id"] is None:
        return jsonify([])

    rows = query(
        """
        SELECT
            observer_id,
            professor_name,
            professor_department,
            selected_date
        FROM observation_requests
        JOIN professors
            ON professors.professor_id = observation_requests.observer_id
        WHERE observation_requests.meeting_id = %s
          AND observation_requests.status = 'accepted'
        """,
        (selected[0]["meeting_id"],),
    )

    for row in rows:
        if row["selected_date"] is not None:
            row["selected_date"] = row["selected_date"].isoformat()

    return jsonify(rows)


@app.route("/api/observers/request", methods=["POST"])
@faculty_required
def send_observer_requests():
    data = request.get_json(silent=True) or {}
    signup_semester = str(data.get("signup_semester") or "").strip()
    raw_observer_ids = data.get("observer_ids")

    if data.get("observee_id") is None or not signup_semester or not isinstance(raw_observer_ids, list) or not raw_observer_ids:
        return jsonify(error="observee_id, signup_semester, and observer_ids are required"), 400

    try:
        observee_id = int(data.get("observee_id"))
        observer_ids = [int(observer_id) for observer_id in raw_observer_ids]
    except (TypeError, ValueError):
        return jsonify(error="observee_id and observer_ids must be integers"), 400
    if observee_id != g.user_id:
        return jsonify(error="You may only send requests for your own sign-up"), 403

    selected = query(
        """
        SELECT m.meeting_id, m.observer_id
        FROM observees o
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        WHERE o.observee_id = %s AND o.signup_sem = %s
        """,
        (observee_id, signup_semester),
    )
    if not selected or selected[0]["meeting_id"] is None:
        return jsonify(error="No meeting was found for this sign-up"), 404
    if selected[0]["observer_id"] is not None:
        return jsonify(error="An observation is already scheduled for this class"), 409

    meeting_id = selected[0]["meeting_id"]

    def mark_pending(cur):
        sent_ids = []
        skipped = []
        for observer_id in observer_ids:
            cur.execute(
                """
                UPDATE observation_requests
                SET status = 'pending', sent_at = NOW()
                WHERE meeting_id = %s
                  AND observer_id = %s
                  AND status = 'approved'
                """,
                (meeting_id, observer_id),
            )
            if cur.rowcount == 1:
                sent_ids.append(observer_id)
            else:
                skipped.append(observer_id)
        if not sent_ids:
            return sent_ids, skipped, [], ""

        placeholders = ", ".join(["%s"] * len(sent_ids))
        cur.execute(
            f"""
            SELECT p.professor_id AS observer_id, p.professor_name, u.email
            FROM professors p
            JOIN users u ON u.id = p.professor_id
            WHERE p.professor_id IN ({placeholders})
            """,
            tuple(sent_ids),
        )
        recipients = cur.fetchall()
        cur.execute(
            "SELECT professor_name FROM professors WHERE professor_id = %s",
            (observee_id,),
        )
        observee = cur.fetchone()
        observee_name = observee["professor_name"] if observee else "An observee"
        cur.execute(
            """
            SELECT CONCAT(c.department, ' ', c.course_number, '.', c.section_number)
                AS course_label
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            WHERE m.meeting_id = %s
            """,
            (meeting_id,),
        )
        course_row = cur.fetchone()
        course = course_row["course_label"] if course_row else "class"
        message = (
            f"{observee_name} asked you to observe their {course} class for "
            f"{signup_semester}. In the sidebar, go to Observer > Observe Others "
            "to review the proposed dates and respond within 48 hours."
        )
        insert_notifications(
            cur,
            sent_ids,
            f"Observation request — {signup_semester}",
            message,
            observee_id,
        )
        return sent_ids, skipped, recipients, message

    sent_ids, skipped, recipients, message = transaction(mark_pending)
    if not sent_ids:
        return jsonify(
            error="None of the selected observers can be requested",
            skipped=skipped,
        ), 409

    email_errors = []
    sent = []
    for index, recipient in enumerate(recipients):
        if index:
            time.sleep(EMAILJS_RATE_LIMIT_SECONDS)
        email_result = send_notification_email(
            recipient["email"], message, name=recipient["professor_name"] or ""
        )
        if email_result["email_error"]:
            email_errors.append(email_result["email_error"])
        sent.append({
            "observer_id": recipient["observer_id"],
            "professor_name": recipient["professor_name"],
            "notified": email_result["email_sent"],
        })

    return jsonify(
        sent=sent,
        skipped=skipped,
        notificationCount=len(recipients),
        emailError="; ".join(dict.fromkeys(email_errors)) or None,
    )


MAX_CONFIRMED_OBSERVATIONS = 3


class ObservationRuleError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


def _iso_date(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _observer_request_record(row, offered_dates):
    return {
        "meeting_id": row["meeting_id"],
        "observee_id": row["observee_id"],
        "observee_name": row["observee_name"],
        "signup_semester": row["signup_sem"],
        "course_department": row["course_department"],
        "course_number": row["course_number"],
        "section_number": row["section_number"],
        "course_name": row["course_name"],
        "course_day": row["course_day"],
        "course_start_time": row["course_start_time"],
        "course_end_time": row["course_end_time"],
        "room_number": row["room_number"],
        "offered_dates": offered_dates,
        "selected_date": _iso_date(row["selected_date"]),
        "status": row["status"],
        "minutes_left": None if row["minutes_left"] is None else int(row["minutes_left"]),
    }


def _load_observer_requests(observer_id):
    query(
        """
        UPDATE observation_requests
        SET status = 'expired'
        WHERE observer_id = %s
          AND status = 'pending'
          AND sent_at IS NOT NULL
          AND sent_at < NOW() - INTERVAL 48 HOUR
        """,
        (observer_id,),
        fetch=False,
    )
    rows = query(
        """
        SELECT
            ob_r.meeting_id,
            ob_r.status,
            ob_r.selected_date,
            o.observee_id,
            o.signup_sem,
            observee.professor_name AS observee_name,
            c.department AS course_department,
            c.course_number,
            c.section_number,
            c.course_name,
            c.course_day,
            c.course_start_time,
            c.course_end_time,
            c.room_number,
            TIMESTAMPDIFF(
                MINUTE,
                NOW(),
                ob_r.sent_at + INTERVAL 48 HOUR
            ) AS minutes_left
        FROM observation_requests ob_r
        JOIN meetings m ON m.meeting_id = ob_r.meeting_id
        JOIN observees o ON o.signup_course = m.course_id
        JOIN professors observee ON observee.professor_id = o.observee_id
        LEFT JOIN courses c ON c.course_id = m.course_id
        WHERE ob_r.observer_id = %s
          AND ob_r.status IN ('pending', 'accepted', 'confirmed')
          AND (
              ob_r.status <> 'pending'
              OR (
                  ob_r.sent_at IS NOT NULL
                  AND ob_r.sent_at >= NOW() - INTERVAL 48 HOUR
              )
          )
        ORDER BY ob_r.status = 'pending' DESC, ob_r.meeting_id
        """,
        (observer_id,),
    )
    if not rows:
        return []

    pairs = {(row["observee_id"], row["signup_sem"]) for row in rows}
    placeholders = " OR ".join(["(observee_id = %s AND signup_sem = %s)"] * len(pairs))
    params = [value for pair in pairs for value in pair]
    date_rows = query(
        f"""
        SELECT observee_id, signup_sem, offered_date
        FROM signup_dates
        WHERE {placeholders}
        ORDER BY offered_date
        """,
        tuple(params),
    )
    dates_by_signup = {}
    for date_row in date_rows:
        key = (date_row["observee_id"], date_row["signup_sem"])
        dates_by_signup.setdefault(key, []).append(_iso_date(date_row["offered_date"]))

    return [
        _observer_request_record(
            row,
            dates_by_signup.get((row["observee_id"], row["signup_sem"]), []),
        )
        for row in rows
    ]


def _pending_request_for_observer(observer_id, meeting_id):
    rows = query(
        """
        SELECT
            ob_r.status,
            ob_r.sent_at,
            o.observee_id,
            o.signup_sem
        FROM observation_requests ob_r
        JOIN meetings m ON m.meeting_id = ob_r.meeting_id
        JOIN observees o ON o.signup_course = m.course_id
        WHERE ob_r.meeting_id = %s
          AND ob_r.observer_id = %s
        """,
        (meeting_id, observer_id),
    )
    return rows[0] if rows else None


@app.route("/api/observer-requests")
@faculty_required
def get_observer_requests():
    return jsonify(_load_observer_requests(g.user_id))


@app.route("/api/observer-requests/<int:meeting_id>/accept", methods=["POST"])
@faculty_required
def accept_observer_request(meeting_id):
    selected_date = str((request.get_json(silent=True) or {}).get("selected_date") or "").strip()
    if not selected_date:
        return jsonify(error="selected_date is required"), 400

    current = _pending_request_for_observer(g.user_id, meeting_id)
    if current is None:
        return jsonify(error="Observation request was not found"), 404
    if current["observee_id"] == g.user_id:
        return jsonify(error="You cannot accept your own observation request"), 409
    if current["status"] != "pending":
        return jsonify(error="This request is no longer pending"), 409
    if current["sent_at"] is None:
        return jsonify(error="This request is no longer pending"), 409

    expired = query(
        """
        SELECT meeting_id
        FROM observation_requests
        WHERE meeting_id = %s
          AND observer_id = %s
          AND status = 'pending'
          AND sent_at < NOW() - INTERVAL 48 HOUR
        """,
        (meeting_id, g.user_id),
    )
    if expired:
        query(
            """
            UPDATE observation_requests
            SET status = 'expired'
            WHERE meeting_id = %s
              AND observer_id = %s
              AND status = 'pending'
              AND sent_at < NOW() - INTERVAL 48 HOUR
            """,
            (meeting_id, g.user_id),
            fetch=False,
        )
        return jsonify(error="This request has expired"), 409

    offered = query(
        """
        SELECT offered_date
        FROM signup_dates
        WHERE observee_id = %s AND signup_sem = %s AND offered_date = %s
        """,
        (current["observee_id"], current["signup_sem"], selected_date),
    )
    if not offered:
        return jsonify(error="Choose one of the dates this observee offered"), 400

    def schedule_acceptance(cur):
        cur.execute(
            "SELECT observer_id FROM meetings WHERE meeting_id = %s FOR UPDATE",
            (meeting_id,),
        )
        meeting = cur.fetchone()
        if meeting is None:
            raise ObservationRuleError("Observation request was not found", 404)
        if meeting["observer_id"] is not None:
            raise ObservationRuleError("This observation is already scheduled", 409)

        # only this semester's observations count toward the cap of 3
        cur.execute(
            """
            SELECT r.status
            FROM observation_requests r
            JOIN meetings m ON m.meeting_id = r.meeting_id
            JOIN courses c ON c.course_id = m.course_id
            WHERE r.observer_id = %s
              AND c.semester = (
                  SELECT c2.semester
                  FROM meetings m2
                  JOIN courses c2 ON c2.course_id = m2.course_id
                  WHERE m2.meeting_id = %s
              )
            FOR UPDATE OF r
            """,
            (g.user_id, meeting_id),
        )
        confirmed = sum(
            1
            for row in cur.fetchall()
            if row["status"] in ("accepted", "confirmed")
        )
        if confirmed >= MAX_CONFIRMED_OBSERVATIONS:
            raise ObservationRuleError(
                "You already have 3 confirmed observations",
                409,
            )

        cur.execute(
            """
            UPDATE observation_requests
            SET status = 'accepted', selected_date = %s, responded_at = NOW()
            WHERE meeting_id = %s
              AND observer_id = %s
              AND status = 'pending'
              AND sent_at IS NOT NULL
              AND sent_at >= NOW() - INTERVAL 48 HOUR
            """,
            (selected_date, meeting_id, g.user_id),
        )
        if cur.rowcount != 1:
            raise ObservationRuleError("This request is no longer pending", 409)

        cur.execute(
            """
            SELECT o.observee_id, o.signup_sem,
                   p.professor_name AS observee_name, u.email
            FROM meetings m
            JOIN observees o ON o.signup_course = m.course_id
            JOIN professors p ON p.professor_id = o.observee_id
            JOIN users u ON u.id = o.observee_id
            WHERE m.meeting_id = %s AND o.signup_sem = %s
            """,
            (meeting_id, current["signup_sem"]),
        )
        observee = cur.fetchone()
        if observee is None:
            raise ObservationRuleError("Observee account was not found", 404)
        cur.execute(
            """
            SELECT CONCAT(c.department, ' ', c.course_number, '.', c.section_number)
                AS course_label
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            WHERE m.meeting_id = %s
            """,
            (meeting_id,),
        )
        course_row = cur.fetchone()
        course = course_row["course_label"] if course_row else "class"
        message = (
            f"An observer accepted your request for {course} ({current['signup_sem']}) "
            f"on {selected_date}. In the sidebar, go to Observee > My Observer "
            "to confirm the observer."
        )
        insert_notifications(
            cur,
            [observee["observee_id"]],
            f"Observer accepted — {current['signup_sem']}",
            message,
            g.user_id,
        )
        return {
            "email": observee["email"],
            "name": observee["observee_name"] or "",
            "message": message,
        }

    try:
        notification = transaction(schedule_acceptance)
    except ObservationRuleError as exc:
        return jsonify(error=str(exc)), exc.status_code

    email_result = send_notification_email(
        notification["email"],
        notification["message"],
        name=notification["name"],
    )
    return jsonify(
        meeting_id=meeting_id,
        status="accepted",
        selected_date=selected_date,
        notificationSent=True,
        emailSent=email_result["email_sent"],
        emailError=email_result["email_error"],
    )


@app.route("/api/observer-requests/<int:meeting_id>/decline", methods=["POST"])
@faculty_required
def decline_observer_request(meeting_id):
    current = _pending_request_for_observer(g.user_id, meeting_id)
    if current is None:
        return jsonify(error="Observation request was not found"), 404
    if current["status"] != "pending":
        return jsonify(error="This request is no longer pending"), 409
    if current["sent_at"] is not None:
        expired = query(
            """
            SELECT meeting_id
            FROM observation_requests
            WHERE meeting_id = %s
              AND observer_id = %s
              AND status = 'pending'
              AND sent_at < NOW() - INTERVAL 48 HOUR
            """,
            (meeting_id, g.user_id),
        )
        if expired:
            query(
                """
                UPDATE observation_requests
                SET status = 'expired'
                WHERE meeting_id = %s
                  AND observer_id = %s
                  AND status = 'pending'
                  AND sent_at < NOW() - INTERVAL 48 HOUR
                """,
                (meeting_id, g.user_id),
                fetch=False,
            )
            return jsonify(error="This request has expired"), 409

    updated = query(
        """
        UPDATE observation_requests
        SET status = 'declined', responded_at = NOW()
        WHERE meeting_id = %s AND observer_id = %s AND status = 'pending'
        """,
        (meeting_id, g.user_id),
        fetch=False,
    )
    if not updated:
        return jsonify(error="This request is no longer pending"), 409
    return jsonify(meeting_id=meeting_id, status="declined")


@app.route("/api/observers/confirm", methods=["POST"])
@faculty_required
def confirm_observer():
    data = request.get_json(silent=True) or {}
    signup_semester = str(data.get("signup_semester") or "").strip()

    try:
        observer_id = int(data.get("observer_id"))
    except (TypeError, ValueError):
        return jsonify(error="signup_semester and observer_id are required"), 400

    if not signup_semester:
        return jsonify(error="signup_semester and observer_id are required"), 400
    if observer_id == g.user_id:
        return jsonify(error="You cannot accept yourself as the observer"), 409

    selected = query(
        """
        SELECT m.meeting_id
        FROM observees o
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        WHERE o.observee_id = %s AND o.signup_sem = %s
        """,
        (g.user_id, signup_semester),
    )
    if not selected or selected[0]["meeting_id"] is None:
        return jsonify(error="No meeting was found for this sign-up"), 404

    meeting_id = selected[0]["meeting_id"]

    def schedule_confirmation(cur):
        cur.execute(
            """
            SELECT observer_id
            FROM meetings
            WHERE meeting_id = %s
            FOR UPDATE
            """,
            (meeting_id,),
        )
        meeting = cur.fetchone()
        if meeting is None:
            raise ObservationRuleError("No meeting was found for this sign-up", 404)
        if meeting["observer_id"] is not None:
            raise ObservationRuleError(
                "An observation is already scheduled for this class",
                409,
            )

        cur.execute(
            """
            SELECT status, selected_date
            FROM observation_requests
            WHERE meeting_id = %s AND observer_id = %s
            FOR UPDATE
            """,
            (meeting_id, observer_id),
        )
        request_row = cur.fetchone()
        if (
            request_row is None
            or request_row["status"] != "accepted"
            or request_row["selected_date"] is None
        ):
            raise ObservationRuleError(
                "Accept an observer only after they have accepted a date",
                409,
            )

        cur.execute(
            """
            SELECT p.professor_name, u.email
            FROM professors p
            JOIN users u ON u.id = p.professor_id
            WHERE p.professor_id = %s
            """,
            (observer_id,),
        )
        selected_observer = cur.fetchone()
        if selected_observer is None:
            raise ObservationRuleError("Observer account was not found", 404)

        cur.execute(
            """
            SELECT r.observer_id, p.professor_name, u.email
            FROM observation_requests r
            JOIN professors p ON p.professor_id = r.observer_id
            JOIN users u ON u.id = r.observer_id
            WHERE r.meeting_id = %s
              AND r.observer_id <> %s
              AND r.sent_at IS NOT NULL
            """,
            (meeting_id, observer_id),
        )
        not_selected_observers = cur.fetchall()
        cur.execute(
            """
            SELECT CONCAT(c.department, ' ', c.course_number, '.', c.section_number)
                AS course_label
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            WHERE m.meeting_id = %s
            """,
            (meeting_id,),
        )
        course_row = cur.fetchone()
        course = course_row["course_label"] if course_row else "class"
        selected_message = (
            f"You were confirmed as the observer for {course} ({signup_semester}) "
            f"on {_iso_date(request_row['selected_date'])}. In the sidebar, go to "
            "My Schedule to view the observation details."
        )
        insert_notifications(
            cur,
            [observer_id],
            f"Observer confirmed — {signup_semester}",
            selected_message,
            g.user_id,
        )
        rejected_message = (
            f"The observee selected another observer for {course} ({signup_semester}). "
            "Thank you for responding to the request."
        )
        insert_notifications(
            cur,
            [row["observer_id"] for row in not_selected_observers],
            f"Observation request not selected — {signup_semester}",
            rejected_message,
            g.user_id,
        )

        cur.execute(
            """
            UPDATE meetings
            SET observer_id = %s, meeting_date = %s
            WHERE meeting_id = %s AND observer_id IS NULL
            """,
            (observer_id, request_row["selected_date"], meeting_id),
        )
        if cur.rowcount != 1:
            raise ObservationRuleError(
                "An observation is already scheduled for this class",
                409,
            )

        cur.execute(
            """
            UPDATE observation_requests
            SET status = 'confirmed'
            WHERE meeting_id = %s AND observer_id = %s AND status = 'accepted'
            """,
            (meeting_id, observer_id),
        )
        cur.execute(
            """
            UPDATE observation_requests
            SET status = 'not_selected'
            WHERE meeting_id = %s
              AND observer_id <> %s
              AND status IN ('generated', 'approved', 'pending', 'accepted')
            """,
            (meeting_id, observer_id),
        )
        return {
            "selected_date": _iso_date(request_row["selected_date"]),
            "emails": [
                {
                    "email": selected_observer["email"],
                    "name": selected_observer["professor_name"] or "",
                    "message": selected_message,
                },
                *[
                    {
                        "email": row["email"],
                        "name": row["professor_name"] or "",
                        "message": rejected_message,
                    }
                    for row in not_selected_observers
                ],
            ],
        }

    try:
        confirmation = transaction(schedule_confirmation)
    except ObservationRuleError as exc:
        return jsonify(error=str(exc)), exc.status_code
    except IntegrityError:
        return jsonify(error="That observer cannot be scheduled"), 409

    email_errors = []
    for index, recipient in enumerate(confirmation["emails"]):
        if index:
            time.sleep(EMAILJS_RATE_LIMIT_SECONDS)
        email_result = send_notification_email(
            recipient["email"],
            recipient["message"],
            name=recipient["name"],
        )
        if email_result["email_error"]:
            email_errors.append(email_result["email_error"])

    return jsonify(
        observer_id=observer_id,
        status="confirmed",
        selected_date=confirmation["selected_date"],
        notifiedCount=len(confirmation["emails"]),
        emailError="; ".join(dict.fromkeys(email_errors)) or None,
    )


@app.route("/api/observers/escalate", methods=["POST"])
@faculty_required
def escalate_observer_search():
    data = request.get_json(silent=True) or {}
    signup_semester = str(data.get("signup_semester") or "").strip()
    if not signup_semester:
        return jsonify(error="signup_semester is required"), 400

    def create_escalation(cur):
        cur.execute(
            """
            SELECT o.signup_course, p.professor_name
            FROM observees o
            JOIN professors p ON p.professor_id = o.observee_id
            WHERE o.observee_id = %s AND o.signup_sem = %s
            FOR UPDATE
            """,
            (g.user_id, signup_semester),
        )
        signup = cur.fetchone()
        if signup is None or signup["signup_course"] is None:
            raise ObservationRuleError("No sign-up was found for this semester", 404)

        cur.execute(
            "SELECT meeting_id FROM meetings WHERE course_id = %s ORDER BY meeting_id LIMIT 1",
            (signup["signup_course"],),
        )
        meeting = cur.fetchone()
        if meeting is None:
            raise ObservationRuleError("No observation requests were found", 409)

        cur.execute(
            """
            SELECT CONCAT(department, ' ', course_number, '.', section_number)
                AS course_label
            FROM courses
            WHERE course_id = %s
            """,
            (signup["signup_course"],),
        )
        course = cur.fetchone()
        course_label = course["course_label"] if course else "the course"

        cur.execute(
            """
            UPDATE observation_requests
            SET status = 'expired'
            WHERE meeting_id = %s AND status = 'pending'
              AND sent_at IS NOT NULL
              AND sent_at < NOW() - INTERVAL 48 HOUR
            """,
            (meeting["meeting_id"],),
        )
        cur.execute(
            """
            SELECT observer_id, status
            FROM observation_requests
            WHERE meeting_id = %s AND sent_at IS NOT NULL
              AND status IN ('pending', 'accepted', 'declined', 'expired')
            FOR UPDATE
            """,
            (meeting["meeting_id"],),
        )
        invitations = cur.fetchall()
        if not invitations:
            raise ObservationRuleError("No observer requests have been sent", 409)
        if any(row["status"] not in ("declined", "expired") for row in invitations):
            raise ObservationRuleError(
                "Wait until every invited observer declines or their request expires",
                409,
            )

        cur.execute(
            """
            SELECT ac.ac_id AS user_id, p.professor_name AS name, u.email
            FROM assessment_committee ac
            JOIN professors p ON p.professor_id = ac.ac_id
            JOIN users u ON u.id = ac.ac_id
            WHERE u.is_active = TRUE
            ORDER BY p.professor_name
            """
        )
        recipients = cur.fetchall()
        if not recipients:
            raise ObservationRuleError("No active Assessment Committee members were found", 409)

        message = (
            f"All invited observers have declined or their requests expired for "
            f"{signup_semester}. {signup['professor_name']} is requesting help "
            f"finding additional observers for {course_label}."
        )
        cur.execute(
            """
            INSERT INTO observer_escalations (observee_id, signup_sem)
            VALUES (%s, %s)
            """,
            (g.user_id, signup_semester),
        )
        insert_notifications(
            cur,
            [row["user_id"] for row in recipients],
            f"Additional observers requested — {signup_semester}",
            message,
            g.user_id,
        )
        return {"recipients": recipients, "message": message}

    try:
        escalation = transaction(create_escalation)
    except ObservationRuleError as exc:
        return jsonify(error=str(exc)), exc.status_code
    except IntegrityError:
        return jsonify(error="The Assessment Committee has already been notified"), 409

    email_errors = []
    sent_count = 0
    for index, recipient in enumerate(escalation["recipients"]):
        if index:
            time.sleep(EMAILJS_RATE_LIMIT_SECONDS)
        email_result = send_notification_email(
            recipient["email"],
            escalation["message"],
            name=recipient["name"] or "",
        )
        if email_result["email_sent"]:
            sent_count += 1
        if email_result["email_error"]:
            email_errors.append(email_result["email_error"])

    return jsonify(
        notifiedCount=len(escalation["recipients"]),
        emailSentCount=sent_count,
        emailError="; ".join(dict.fromkeys(email_errors)) or None,
    )


@app.route("/api/observers", methods=["POST"])
def generate_single_observer_list():
    raw_observee_id = request.args.get("observee_id", "").strip()
    signup_semester = request.args.get("signup_semester", "").strip()

    if not raw_observee_id or not signup_semester:
        return jsonify(error="observee_id and signup_semester are required"), 400

    try:
        observee_id = int(raw_observee_id)
    except ValueError:
        return jsonify(error="observee_id must be an integer"), 400

    try:
        candidates = generate_observer_list(observee_id, signup_semester)
    except ObserverListLocked as error:
        return jsonify(error=str(error)), 409
    except ValueError as error:
        return jsonify(error=str(error)), 404

    return jsonify(candidates)


@app.route("/api/observers/generate", methods=["POST"])
def generate_observer_lists():
    signup_semester = request.args.get("signup_semester", "").strip()
    if not signup_semester:
        return jsonify(error="signup_semester is required"), 400

    observees = query(
        """
        SELECT observee_id
        FROM observees
        WHERE signup_sem = %s
        ORDER BY observee_id
        """,
        (signup_semester,),
    )

    generated = []
    failures = []
    for observee in observees:
        observee_id = observee["observee_id"]
        try:
            candidates = generate_observer_list(observee_id, signup_semester)
            generated.append({
                "observee_id": observee_id,
                "observer_count": len(candidates),
            })
        except (Error, ValueError) as error:
            failures.append({
                "observee_id": observee_id,
                "error": str(error),
            })

    return jsonify({
        "signup_semester": signup_semester,
        "total_observees": len(observees),
        "generated": len(generated),
        "failed": len(failures),
        "lists": generated,
        "failures": failures,
    })

@app.route("/api/meeting", methods=["POST"])
def create_meeting():
    raw_observee_id = request.args.get("observee_id", "").strip()
    signup_semester = request.args.get("signup_semester", "").strip()

    if not raw_observee_id or not signup_semester:
        return jsonify(error="observee_id and signup_semester are required"), 400

    try:
        observee_id = int(raw_observee_id)
    except ValueError:
        return jsonify(error="observee_id must be an integer"), 400

    observee = query(
        """
        SELECT signup_course
        FROM observees
        WHERE observee_id = %s
          AND signup_sem = %s
        """,
        (observee_id, signup_semester),
    )

    if not observee:
        return jsonify(error="Observee signup was not found"), 404

    course_id = observee[0]["signup_course"]
    if course_id is None:
        return jsonify(error="Observee has no signup course"), 422

    existing = query(
        """
        SELECT m.meeting_id
        FROM meetings m
        JOIN observees o ON o.signup_course = m.course_id
        WHERE o.observee_id = %s
          AND o.signup_sem = %s
        """,
        (observee_id, signup_semester),
    )

    if existing:
        return jsonify(
            error="A meeting already exists for this observee and semester"
        ), 409

    meeting_id = query(
        """
        INSERT INTO meetings (course_id)
        VALUES (%s)
        """,
        (course_id,),
        fetch=False,
    )

    return jsonify({
        "meeting_id": meeting_id,
        "observee_id": observee_id,
        "signup_semester": signup_semester,
        "course_id": course_id,
    }), 201
    
@app.route("/api/tracking")
@ac_required
def get_observation_tracking():
    signup_semester = request.args.get("signup_semester", "").strip()
    if not signup_semester:
        return jsonify(error="signup_semester is required"), 400
    rows = query(TRACKING_SELECT, (signup_semester,))
    return jsonify({
        "signupSemester": signup_semester,
        "observations": [tracking_record(row) for row in rows],
    })


@app.route("/api/faculty/schedule")
@faculty_required
def get_faculty_schedule():
    semester = request.args.get("semester", "").strip()
    if not semester:
        return jsonify(error="semester is required"), 400

    conducting = query(
        FACULTY_SCHEDULE_CONDUCTING_SELECT,
        (g.user_id, semester),
    )
    scheduled_for_me = query(
        FACULTY_SCHEDULE_OBSERVEE_SELECT,
        (g.user_id, semester),
    )

    return jsonify({
        "conducting": [faculty_schedule_record(row) for row in conducting],
        "scheduledForMe": [
            faculty_schedule_record(row) for row in scheduled_for_me
        ],
    })
    

@app.route("/api/health")
def health():
    return jsonify(status="ok")

@app.route("/api/schedule") # returns all evaluation cycles
@ac_required
def get_schedules():
    rows = query(CYCLE_SELECT)
    return jsonify(rows)


@app.route("/api/schedule/<semester>", methods=["PUT"])
@ac_required
def save_schedule(semester):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(error="A JSON object is required"), 400

    fields = [
        "signupDeadline",
        "observationDeadline",
        "feedbackDeadline"
    ]

    deadlines = []

    for field in fields:
        value = data.get(field)

        if not isinstance(value, str):
            return jsonify(error=f"{field} is required"), 400

        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("Timezone is required")
            deadlines.append(parsed.astimezone(timezone.utc))
        except ValueError:
            return jsonify(error=f"{field} must be a valid timezone-aware date"), 400

    if not (deadlines[0] < deadlines[1] < deadlines[2]):
        return jsonify(error="Deadlines must be in chronological order"), 400

    #TODO: figure out what status to use
    query(
        CYCLE_UPSERT,
        (
            semester,
            "draft",
            deadlines[0].replace(tzinfo=None),
            deadlines[1].replace(tzinfo=None),
            deadlines[2].replace(tzinfo=None)
        ),
        fetch=False
    )

    return jsonify(message="Evaluation cycle saved successfully")


# DON'T PUT ANYTHING BELOW THIS
if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5001)
