from pathlib import Path
import json
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import IntegrityError
from dotenv import load_dotenv

from db import query, pool
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, message, status=400):
        self.message = message
        self.status = status


@app.errorhandler(ApiError)
def handle_api_error(e):
    return jsonify({"error": e.message}), e.status


@app.errorhandler(IntegrityError)
def handle_integrity_error(e):
    # Duplicate keys, missing parent rows (foreign keys), failed CHECKs
    return jsonify({
        "error": "Database constraint violated (duplicate, or a referenced record doesn't exist)",
        "detail": e.msg,
    }), 409


def body_json():
    return request.get_json(silent=True) or {}


def one(sql, params=None):
    """Return the first row of a SELECT, or None."""
    rows = query(sql, params)
    return rows[0] if rows else None


def current_user_id():
    """
    PLACEHOLDER AUTH: reads the caller's id from an X-User-Id header.
    Replace this with real authentication (sessions, JWT, SSO) later.
    """
    raw = request.headers.get("X-User-Id", "")
    if not raw.isdigit():
        raise ApiError("Missing or invalid X-User-Id header", 401)
    return int(raw)


@contextmanager
def transaction():
    """Run several statements as one unit: all succeed or all roll back."""
    conn = pool.get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def parse_json_column(value):
    if isinstance(value, (str, bytes, bytearray)):
        return json.loads(value)
    return value


def to_float(value):
    return float(value) if value is not None else None


# A meeting row lines up with a course row when these four columns match
MEETING_COURSE_JOIN = """
    m.department = c.department
    AND m.course_number = c.course_number
    AND m.section_number = c.section_number
    AND m.semester = c.semester
"""

# One "observation" = a meeting + its course + names + a derived status
OBS_SELECT = f"""
    SELECT
        m.meeting_id AS id,
        m.meeting_date,
        m.department,
        m.course_number,
        m.section_number,
        m.semester,
        c.course_name,
        c.course_times,
        c.room_number,
        c.observee_id,
        po.professor_name AS observee_name,
        m.observer_id,
        pr.professor_name AS observer_name,
        m.ac_id,
        CASE
            WHEN r.meeting_id IS NOT NULL THEN 'completed'
            WHEN m.observer_id IS NULL THEN 'needs_observer'
            ELSE 'scheduled'
        END AS status
    FROM meetings m
    JOIN courses c ON {MEETING_COURSE_JOIN}
    JOIN professors po ON po.professor_id = c.observee_id
    LEFT JOIN professors pr ON pr.professor_id = m.observer_id
    LEFT JOIN reports r ON r.meeting_id = m.meeting_id
"""

# One row per professor, with role flags and observation counts
PROFESSOR_SELECT = f"""
    SELECT
        p.professor_id AS id,
        p.professor_name AS name,
        u.username,
        o.observee_rank,
        o.observee_department,
        o.last_sem_observed,
        o.hiring_sem,
        ob.observer_department,
        o.observee_id IS NOT NULL AS is_observee,
        ob.observer_id IS NOT NULL AS is_observer,
        ac.ac_id IS NOT NULL AS is_ac_member,
        (SELECT COUNT(*)
           FROM courses c
           JOIN meetings m ON {MEETING_COURSE_JOIN}
          WHERE c.observee_id = p.professor_id) AS observations_total,
        (SELECT COUNT(*)
           FROM courses c
           JOIN meetings m ON {MEETING_COURSE_JOIN}
           JOIN reports r ON r.meeting_id = m.meeting_id
          WHERE c.observee_id = p.professor_id) AS observations_completed
    FROM professors p
    JOIN users u ON u.id = p.professor_id
    LEFT JOIN observees o ON o.observee_id = p.professor_id
    LEFT JOIN observers ob ON ob.observer_id = p.professor_id
    LEFT JOIN assessment_committee ac ON ac.ac_id = p.professor_id
"""

RATING_FIELDS = [
    "content_clarity",
    "student_engagement",
    "openness_to_questions",
    "tech_use",
    "slide_readability",
    "lecture_pace",
]


def clean_professor_row(row):
    for flag in ("is_observee", "is_observer", "is_ac_member"):
        row[flag] = bool(row[flag])
    total, done = row["observations_total"], row["observations_completed"]
    if total == 0:
        row["evaluation_status"] = "not_scheduled"
    elif done == total:
        row["evaluation_status"] = "completed"
    else:
        row["evaluation_status"] = "in_progress"
    return row


def fetch_user(user_id):
    row = one(PROFESSOR_SELECT + " WHERE p.professor_id = %s", (user_id,))
    if not row:
        return None
    row = clean_professor_row(row)
    row["observee_course_levels"] = [
        r["course_level"] for r in query(
            "SELECT course_level FROM observee_course_levels WHERE observee_id = %s",
            (user_id,))
    ]
    row["observer_course_levels"] = [
        r["course_level"] for r in query(
            "SELECT course_level FROM observer_course_levels WHERE observer_id = %s",
            (user_id,))
    ]
    return row


def fetch_observation(obs_id):
    obs = one(f"SELECT * FROM ({OBS_SELECT}) AS o WHERE o.id = %s", (obs_id,))
    if not obs:
        return None
    obs["report"] = one("SELECT * FROM reports WHERE meeting_id = %s", (obs_id,))
    obs["invitations"] = query(
        """SELECT i.invitation_id, i.observer_id, p.professor_name AS observer_name, i.status
             FROM invitations i
             JOIN professors p ON p.professor_id = i.observer_id
            WHERE i.meeting_id = %s""",
        (obs_id,))
    return obs


# ---------------------------------------------------------------------------
# AC member endpoints: users
# ---------------------------------------------------------------------------

# GET all teachers, their info, and evaluation statuses
@app.get("/api/users")
def list_users():
    rows = query(PROFESSOR_SELECT + " ORDER BY p.professor_name")
    return jsonify([clean_professor_row(r) for r in rows])


# GET one teacher (also used by teachers to get their own info)
@app.get("/api/users/<int:user_id>")
def get_user(user_id):
    user = fetch_user(user_id)
    if not user:
        raise ApiError("User not found", 404)
    return jsonify(user)


# POST/PUT create or update a teacher
#
# Example body:
# {
#   "username": "jsmith",
#   "name": "Jane Smith",
#   "observee": {"rank": "Assistant Professor", "department": "CS",
#                "last_sem_observed": "Fall 2025", "hiring_sem": "Fall 2023",
#                "course_levels": ["1000", "2000"]},
#   "observer": {"department": "CS", "course_levels": ["3000"]},
#   "ac_member": false
# }
# Only the sections you include are touched. Send every field of a section
# you include, since it is saved as a whole.
@app.route("/api/users/<int:user_id>", methods=["POST", "PUT"])
def upsert_user(user_id):
    data = body_json()
    username = (data.get("username") or "").strip()
    name = (data.get("name") or "").strip()

    user_exists = one("SELECT id FROM users WHERE id = %s", (user_id,)) is not None
    prof_exists = one("SELECT professor_id FROM professors WHERE professor_id = %s",
                      (user_id,)) is not None
    if not user_exists and not username:
        raise ApiError("username is required when creating a user")
    if not prof_exists and not name:
        raise ApiError("name is required when creating a user")

    observee = data.get("observee")
    observer = data.get("observer")

    with transaction() as cur:
        if username:
            cur.execute(
                """INSERT INTO users (id, username) VALUES (%s, %s) AS new
                   ON DUPLICATE KEY UPDATE username = new.username""",
                (user_id, username))
        if name:
            cur.execute(
                """INSERT INTO professors (professor_id, professor_name) VALUES (%s, %s) AS new
                   ON DUPLICATE KEY UPDATE professor_name = new.professor_name""",
                (user_id, name))

        if isinstance(observee, dict):
            cur.execute(
                """INSERT INTO observees
                       (observee_id, observee_rank, observee_department,
                        last_sem_observed, hiring_sem)
                   VALUES (%s, %s, %s, %s, %s) AS new
                   ON DUPLICATE KEY UPDATE
                       observee_rank = new.observee_rank,
                       observee_department = new.observee_department,
                       last_sem_observed = new.last_sem_observed,
                       hiring_sem = new.hiring_sem""",
                (user_id, observee.get("rank"), observee.get("department"),
                 observee.get("last_sem_observed"), observee.get("hiring_sem")))
            if "course_levels" in observee:
                cur.execute("DELETE FROM observee_course_levels WHERE observee_id = %s",
                            (user_id,))
                for level in observee["course_levels"]:
                    cur.execute(
                        "INSERT INTO observee_course_levels (observee_id, course_level) VALUES (%s, %s)",
                        (user_id, level))

        if isinstance(observer, dict):
            cur.execute(
                """INSERT INTO observers (observer_id, observer_department)
                   VALUES (%s, %s) AS new
                   ON DUPLICATE KEY UPDATE observer_department = new.observer_department""",
                (user_id, observer.get("department")))
            if "course_levels" in observer:
                cur.execute("DELETE FROM observer_course_levels WHERE observer_id = %s",
                            (user_id,))
                for level in observer["course_levels"]:
                    cur.execute(
                        "INSERT INTO observer_course_levels (observer_id, course_level) VALUES (%s, %s)",
                        (user_id, level))

        if "ac_member" in data:
            if data["ac_member"]:
                cur.execute("INSERT IGNORE INTO assessment_committee (ac_id) VALUES (%s)",
                            (user_id,))
            else:
                cur.execute("DELETE FROM assessment_committee WHERE ac_id = %s", (user_id,))

    return jsonify(fetch_user(user_id)), (200 if user_exists else 201)


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------

# GET all observations and their status. Optional filters: ?semester=...&status=...
@app.get("/api/obs")
def list_observations():
    sql = f"SELECT * FROM ({OBS_SELECT}) AS o WHERE 1 = 1"
    params = []
    if request.args.get("semester"):
        sql += " AND o.semester = %s"
        params.append(request.args["semester"])
    if request.args.get("status"):
        sql += " AND o.status = %s"
        params.append(request.args["status"])
    sql += " ORDER BY o.meeting_date"
    return jsonify(query(sql, tuple(params)))


# GET one observation (includes its report and invitations)
@app.get("/api/obs/<int:obs_id>")
def get_observation(obs_id):
    obs = fetch_observation(obs_id)
    if not obs:
        raise ApiError("Observation not found", 404)
    return jsonify(obs)


# POST create an observation (not in your endpoint list, but nothing else creates one)
# Body: {"department": "CS", "course_number": "4485", "section_number": "001",
#        "semester": "Fall 2026", "meeting_date": "2026-11-05", "ac_id": 1}
@app.post("/api/obs")
def create_observation():
    data = body_json()
    required = ["department", "course_number", "section_number", "semester", "meeting_date"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        raise ApiError(f"Missing fields: {', '.join(missing)}")

    new_id = query(
        """INSERT INTO meetings
               (meeting_date, department, course_number, section_number, semester, ac_id)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (data["meeting_date"], data["department"], data["course_number"],
         data["section_number"], data["semester"], data.get("ac_id")),
        fetch=False)
    return jsonify(fetch_observation(new_id)), 201


# POST/PUT set the observers for an observation. Two modes:
#   {"observer_ids": [3, 5]}  -> invite these observers (replaces pending invitations)
#   {"observer_id": 3}        -> assign this observer directly
@app.route("/api/obs/<int:obs_id>/observers", methods=["POST", "PUT"])
def set_observers(obs_id):
    if not one("SELECT meeting_id FROM meetings WHERE meeting_id = %s", (obs_id,)):
        raise ApiError("Observation not found", 404)

    data = body_json()

    if "observer_id" in data:
        with transaction() as cur:
            cur.execute("UPDATE meetings SET observer_id = %s WHERE meeting_id = %s",
                        (data["observer_id"], obs_id))
            cur.execute(
                "UPDATE invitations SET status = 'expired' WHERE meeting_id = %s AND status = 'pending'",
                (obs_id,))
    elif isinstance(data.get("observer_ids"), list):
        with transaction() as cur:
            cur.execute("DELETE FROM invitations WHERE meeting_id = %s AND status = 'pending'",
                        (obs_id,))
            for observer_id in data["observer_ids"]:
                cur.execute(
                    """INSERT INTO invitations (meeting_id, observer_id) VALUES (%s, %s)
                       ON DUPLICATE KEY UPDATE status = 'pending'""",
                    (obs_id, observer_id))
    else:
        raise ApiError("Provide either 'observer_ids' (a list) or 'observer_id'")

    return jsonify(fetch_observation(obs_id))


# ---------------------------------------------------------------------------
# AC dashboard KPIs
# ---------------------------------------------------------------------------

@app.get("/api/kpis")
def kpis():
    counts = one(f"""
        SELECT
            (SELECT COUNT(*) FROM professors) AS professors,
            (SELECT COUNT(*) FROM observees) AS observees,
            (SELECT COUNT(*) FROM observers) AS observers,
            (SELECT COUNT(*) FROM assessment_committee) AS ac_members,
            (SELECT COUNT(*) FROM meetings) AS observations_total,
            (SELECT COUNT(*) FROM reports) AS observations_completed,
            (SELECT COUNT(*) FROM meetings WHERE observer_id IS NULL) AS observations_needing_observer,
            (SELECT COUNT(*) FROM invitations WHERE status = 'pending') AS pending_invitations,
            (SELECT COUNT(*) FROM observees o
              WHERE NOT EXISTS (
                  SELECT 1 FROM courses c
                  JOIN meetings m ON {MEETING_COURSE_JOIN}
                  WHERE c.observee_id = o.observee_id)) AS observees_never_scheduled
    """)
    averages = one("""
        SELECT AVG(content_clarity) AS content_clarity,
               AVG(student_engagement) AS student_engagement,
               AVG(openness_to_questions) AS openness_to_questions,
               AVG(tech_use) AS tech_use,
               AVG(slide_readability) AS slide_readability,
               AVG(lecture_pace) AS lecture_pace
          FROM reports
    """)
    counts["observations_scheduled"] = (
        counts["observations_total"]
        - counts["observations_completed"]
        - counts["observations_needing_observer"]
    )
    counts["average_ratings"] = {k: to_float(v) for k, v in averages.items()}
    return jsonify(counts)


# ---------------------------------------------------------------------------
# Schedule and template (stored as JSON, so the frontend decides the shape)
# ---------------------------------------------------------------------------

@app.get("/api/schedule/<semester>")
def get_schedule(semester):
    row = one("SELECT semester, details, updated_at FROM semester_schedules WHERE semester = %s",
              (semester,))
    if not row:
        raise ApiError("No schedule for that semester", 404)
    row["details"] = parse_json_column(row["details"])
    return jsonify(row)


@app.route("/api/schedule/<semester>", methods=["POST", "PUT"])
def set_schedule(semester):
    data = body_json()
    if not data:
        raise ApiError("Request body is required")
    query(
        """INSERT INTO semester_schedules (semester, details) VALUES (%s, %s) AS new
           ON DUPLICATE KEY UPDATE details = new.details""",
        (semester, json.dumps(data)), fetch=False)
    return get_schedule(semester)


@app.get("/api/template")
def get_template():
    row = one("SELECT content, updated_at FROM observation_template WHERE id = 1")
    if not row:
        raise ApiError("No template has been set yet", 404)
    row["content"] = parse_json_column(row["content"])
    return jsonify(row)


@app.route("/api/template", methods=["POST", "PUT"])
def set_template():
    data = body_json()
    if not data:
        raise ApiError("Request body is required")
    query(
        """INSERT INTO observation_template (id, content) VALUES (1, %s) AS new
           ON DUPLICATE KEY UPDATE content = new.content""",
        (json.dumps(data),), fetch=False)
    return get_template()


# ---------------------------------------------------------------------------
# Teacher endpoints (use the X-User-Id header to say who is calling)
# ---------------------------------------------------------------------------

# GET all observations where this professor is the observee or the observer
@app.get("/api/users/<int:user_id>/obs")
def user_observations(user_id):
    if not one("SELECT professor_id FROM professors WHERE professor_id = %s", (user_id,)):
        raise ApiError("User not found", 404)
    rows = query(
        f"""SELECT *,
                   CASE WHEN o.observee_id = %s THEN 'observee' ELSE 'observer' END AS my_role
              FROM ({OBS_SELECT}) AS o
             WHERE o.observee_id = %s OR o.observer_id = %s
             ORDER BY o.meeting_date""",
        (user_id, user_id, user_id))
    return jsonify(rows)


# POST submit the evaluation form (only the assigned observer may do this)
@app.post("/api/obs/<int:obs_id>/form")
def submit_form(obs_id):
    uid = current_user_id()
    meeting = one("SELECT meeting_id, observer_id FROM meetings WHERE meeting_id = %s", (obs_id,))
    if not meeting:
        raise ApiError("Observation not found", 404)
    if meeting["observer_id"] != uid:
        raise ApiError("Only the assigned observer can submit this form", 403)
    if one("SELECT meeting_id FROM reports WHERE meeting_id = %s", (obs_id,)):
        raise ApiError("A report was already submitted for this observation", 409)

    data = body_json()
    bad = [f for f in RATING_FIELDS
           if not isinstance(data.get(f), int) or isinstance(data.get(f), bool)
           or not 1 <= data[f] <= 5]
    if bad:
        raise ApiError(f"These fields must be integers from 1 to 5: {', '.join(bad)}")

    query(
        """INSERT INTO reports
               (meeting_id, content_clarity, student_engagement, openness_to_questions,
                overall_comments, tech_use, slide_readability, lecture_pace)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (obs_id, data["content_clarity"], data["student_engagement"],
         data["openness_to_questions"], data.get("overall_comments"),
         data["tech_use"], data["slide_readability"], data["lecture_pace"]),
        fetch=False)
    return jsonify({"message": "Report submitted", "meeting_id": obs_id}), 201


# POST submit the feedback survey (free-form JSON answers)
@app.post("/api/feedback")
def submit_feedback():
    uid = current_user_id()
    data = body_json()
    if not data:
        raise ApiError("Request body is required")
    new_id = query("INSERT INTO feedback (user_id, answers) VALUES (%s, %s)",
                   (uid, json.dumps(data)), fetch=False)
    return jsonify({"message": "Feedback received", "id": new_id}), 201


# GET this professor's pending invitations
@app.get("/api/invitations")
def list_invitations():
    uid = current_user_id()
    rows = query(
        f"""SELECT i.invitation_id, i.status, i.created_at AS invited_at, obs.*
              FROM invitations i
              JOIN ({OBS_SELECT}) AS obs ON obs.id = i.meeting_id
             WHERE i.observer_id = %s AND i.status = 'pending'
             ORDER BY i.created_at""",
        (uid,))
    return jsonify(rows)


# POST accept an invitation: this professor becomes the observer
@app.post("/api/invitations/<int:inv_id>/accept")
def accept_invitation(inv_id):
    uid = current_user_id()
    with transaction() as cur:
        cur.execute(
            "SELECT invitation_id, meeting_id, observer_id, status "
            "FROM invitations WHERE invitation_id = %s FOR UPDATE", (inv_id,))
        inv = cur.fetchone()
        if not inv or inv["observer_id"] != uid:
            raise ApiError("Invitation not found", 404)
        if inv["status"] != "pending":
            raise ApiError(f"Invitation is already {inv['status']}", 409)

        cur.execute("SELECT observer_id FROM meetings WHERE meeting_id = %s FOR UPDATE",
                    (inv["meeting_id"],))
        meeting = cur.fetchone()
        if meeting["observer_id"] is not None:
            raise ApiError("This observation already has an observer", 409)

        cur.execute("UPDATE invitations SET status = 'accepted' WHERE invitation_id = %s", (inv_id,))
        cur.execute("UPDATE meetings SET observer_id = %s WHERE meeting_id = %s",
                    (uid, inv["meeting_id"]))
        cur.execute(
            """UPDATE invitations SET status = 'expired'
                WHERE meeting_id = %s AND status = 'pending'""",
            (inv["meeting_id"],))

    return jsonify({"message": "Invitation accepted", "meeting_id": inv["meeting_id"]})


# POST decline an invitation
@app.post("/api/invitations/<int:inv_id>/decline")
def decline_invitation(inv_id):
    uid = current_user_id()
    inv = one("SELECT invitation_id, observer_id, status FROM invitations WHERE invitation_id = %s",
              (inv_id,))
    if not inv or inv["observer_id"] != uid:
        raise ApiError("Invitation not found", 404)
    if inv["status"] != "pending":
        raise ApiError(f"Invitation is already {inv['status']}", 409)
    query("UPDATE invitations SET status = 'declined' WHERE invitation_id = %s",
          (inv_id,), fetch=False)
    return jsonify({"message": "Invitation declined"})

@app.route("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
