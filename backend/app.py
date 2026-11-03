from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import IntegrityError
from dotenv import load_dotenv
from auth import auth_bp

from db import query, pool
from datetime import datetime, timezone

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

CYCLE_SELECT = """
    SELECT
        id,
        semester_id,
        semester_label,
        cycle_status,
        signup_deadline,
        observation_deadline,
        feedback_deadline,
        updated_at
    FROM evaluation_cycles
"""

CYCLE_UPSERT = """
    INSERT INTO evaluation_cycles (
        semester_id,
        semester_label,
        cycle_status,
        signup_deadline,
        observation_deadline,
        feedback_deadline
    ) 
    VALUES (%s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        semester_label = VALUES(semester_label),
        cycle_status = VALUES(cycle_status),
        signup_deadline = VALUES(signup_deadline),
        observation_deadline = VALUES(observation_deadline),
        feedback_deadline = VALUES(feedback_deadline)
"""

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

    

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5001)


@app.route("/api/schedule") # grabs all the evaluation cycles, ordered by semester_id
def get_schedules():
    rows = query(CYCLE_SELECT + " ORDER BY semester_id")
    return jsonify(rows)


@app.route("/api/schedule/<semester_id>", methods=["PUT"])
def save_schedule(semester_id):
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

    # Temporary label until semester naming is finalized.
    semester_label = semester_id

    query(
        CYCLE_UPSERT,
        (
            semester_id,
            semester_label,
            deadlines[0].replace(tzinfo=None),
            deadlines[1].replace(tzinfo=None),
            deadlines[2].replace(tzinfo=None)
        ),
        fetch=False
    )

    return jsonify(message="Evaluation cycle saved successfully")


