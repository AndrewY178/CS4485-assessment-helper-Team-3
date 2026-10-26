from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import IntegrityError
from dotenv import load_dotenv

from db import query, pool

# use the .env at the repo root 
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
CORS(app)

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
COURSE_SELECT = f"""
    SELECT *
    FROM courses c
"""

# AC Member GET endpoints

@app.route("/api/users")
def get_users():
    rows = query(PROFESSOR_SELECT + " ORDER BY p.professor_name")
    return jsonify(rows)

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # host: 0.0.0.0 allows for queries from across the wifi network (not just local host)
    app.run(host="0.0.0.0", debug=True, port=5000)
