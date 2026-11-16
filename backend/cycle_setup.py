"""Assessment-cycle setup endpoints."""

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from auth import ac_required
from db import query

cycle_setup_bp = Blueprint("cycle_setup", __name__)

CYCLE_SELECT = """
    SELECT
        semester,
        cycle_status,
        signup_deadline,
        observation_deadline,
        feedback_deadline,
        updated_at
    FROM evaluation_cycles
    ORDER BY semester
"""

CYCLE_BY_SEMESTER_SELECT = CYCLE_SELECT.replace(
    "ORDER BY semester", "WHERE semester = %s"
)

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


def _utc_iso(value):
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _cycle_response(row):
    semester = row["semester"]
    return {
        "id": semester,
        "semesterId": semester,
        "semesterLabel": semester,
        "timezone": "America/Chicago",
        "status": row["cycle_status"],
        "signupDeadline": _utc_iso(row["signup_deadline"]),
        "observationDeadline": _utc_iso(row["observation_deadline"]),
        "feedbackDeadline": _utc_iso(row["feedback_deadline"]),
        "updatedAt": _utc_iso(row["updated_at"]),
    }


def _parse_deadlines(data):
    fields = ("signupDeadline", "observationDeadline", "feedbackDeadline")
    values = []
    for field in fields:
        value = data.get(field)
        if not isinstance(value, str):
            return None, f"{field} is required"
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("Timezone is required")
            values.append(parsed.astimezone(timezone.utc).replace(tzinfo=None))
        except ValueError:
            return None, f"{field} must be a valid timezone-aware date"
    if not values[0] < values[1] < values[2]:
        return None, "Deadlines must be in chronological order"
    return values, None


@cycle_setup_bp.get("/api/schedule")
@ac_required
def get_schedules():
    return jsonify([_cycle_response(row) for row in query(CYCLE_SELECT)])


@cycle_setup_bp.put("/api/schedule/<semester>")
@ac_required
def save_schedule(semester):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="A JSON object is required"), 400

    deadlines, error = _parse_deadlines(data)
    if error:
        return jsonify(error=error), 400

    query(
        CYCLE_UPSERT,
        (semester, "draft", *deadlines),
        fetch=False,
    )
    rows = query(CYCLE_BY_SEMESTER_SELECT, (semester,))
    if not rows:
        return jsonify(error="Saved cycle could not be retrieved"), 500
    return jsonify(_cycle_response(rows[0]))
