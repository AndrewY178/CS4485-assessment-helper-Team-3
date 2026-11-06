from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import IntegrityError
from dotenv import load_dotenv
from auth import ac_required, auth_bp

from db import query, pool

# use the .env at the repo root 
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
CORS(app)
app.register_blueprint(auth_bp)

# SQL statements
PROFESSOR_SELECT = f"""
    SELECT
        p.professor_id AS id,
        p.professor_name AS name,
        u.username,
        p.professor_rank AS prof_rank,
        p.professor_department AS department,
        o.last_sem_observed,
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
        o.last_sem_observed,
        o.hiring_sem,
        o.signup_sem,
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
WITH selected_course AS (
    SELECT
        course_id,
        department,
        semester,
        course_day,
        course_start_time,
        course_end_time,
        prof_id,
        CONCAT(SUBSTRING(course_number, 1, 1), '000') AS course_level
    FROM courses
    WHERE course_id = %s
)
SELECT DISTINCT
    p.professor_id AS id,
    p.professor_name AS name,
    p.professor_department AS department
FROM selected_course s
JOIN courses matching
    ON matching.semester = s.semester
   AND matching.department = s.department
   AND CONCAT(SUBSTRING(matching.course_number, 1, 1), '000')
       = s.course_level
JOIN observees o
    ON o.observee_id = matching.prof_id
JOIN professors p
    ON p.professor_id = o.observee_id
WHERE o.observee_id <> s.prof_id
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
  )
"""
COURSE_SELECT = f"""
    SELECT *
    FROM courses c
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


def tracking_status(row):
    if row["report_exists"]:
        return "report-submitted"
    if row["observer_id"] is not None and row["meeting_date"] is not None:
        return "scheduled"

    request_total = int(row["request_total"] or 0)
    unsuccessful_requests = int(row["declined_count"] or 0) + int(
        row["expired_count"] or 0
    )
    if request_total > 0 and unsuccessful_requests == request_total:
        return "needs-attention"
    return "waiting-on-observer"


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

# request.args for url, request.form for form inputs (like for posts)
# need to return 5 observees that have the same course level and same dept
# and have no classes at that time
@app.route("/api/observers")
def get_observer_list():
    raw_course_id = request.args.get("course_id", "").strip()

    if not raw_course_id:
        return jsonify(error="course_id is required"), 400

    try:
        course_id = int(raw_course_id)
    except ValueError:
        return jsonify(error="course_id must be an integer"), 400

    # check if selected course exists
    selected = query(
        """
        SELECT course_id, course_day, course_start_time, course_end_time
        FROM courses
        WHERE course_id = %s
        """,
        (course_id,),
    )

    if not selected:
        return jsonify(error="Selected course was not found"), 404

    # make sure course has meeting time so it can check against profs schedule
    course = selected[0]
    if not all((
        course["course_day"],
        course["course_start_time"],
        course["course_end_time"],
    )):
        return jsonify(error="Selected course has incomplete meeting information"), 422

    candidates = query(OBSERVER_CANDIDATES_SELECT, (course_id,))
    return jsonify(candidates)


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

    

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5001)
