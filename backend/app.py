from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import IntegrityError
from dotenv import load_dotenv
from auth import auth_bp

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
OBSERVER_SELECT = f"""
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
COURSE_SELECT = f"""
    SELECT *
    FROM courses c
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
    print(signup_semester, flush=True)

    if not signup_semester:
        return jsonify(error="signup_semester is required"), 400

    rows = query(
        OBSERVER_SELECT
        + " WHERE o.signup_sem = %s ORDER BY p.professor_name",
        (signup_semester,),
    )
    return jsonify(rows)

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5001)
