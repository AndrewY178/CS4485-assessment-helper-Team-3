from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import Error, IntegrityError
from dotenv import load_dotenv
from auth import auth_bp

from db import query, pool, transaction

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
    p.professor_id AS id,
    p.professor_name AS name,
    p.professor_department AS department
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
        # delete all the old generated observers if regenerating
        cursor.execute(
            """
            DELETE FROM observation_requests
            WHERE meeting_id = %s
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
                    (course["meeting_id"], candidate["id"])
                    for candidate in candidates
                ],
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
    print(signup_semester, flush=True)

    if not signup_semester:
        return jsonify(error="signup_semester is required"), 400

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

    observers = query(
        """
        SELECT ob_r.observer_id, p.professor_name, p.professor_department
        FROM observation_requests ob_r
        JOIN professors p ON p.professor_id = ob_r.observer_id
        WHERE ob_r.meeting_id = %s
        """,
        (selected[0]["meeting_id"],)
    )

    return jsonify(observers)


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
    
    

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5001)
