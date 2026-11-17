"""Read-only data for the AC dashboard sections that are not on /api/kpis."""

from flask import Blueprint, jsonify

from auth import ac_required
from cycle_setup import calendar_day
from db import query
from kpis import _cycle_key, _load, _signup_record

dashboard_bp = Blueprint("dashboard", __name__)


def _steps(signed_up, unmatched, missing_observations, survey_count):
    completed = [
        signed_up > 0,
        signed_up > 0 and unmatched == 0,
        signed_up > 0 and missing_observations == 0,
        False,
    ]
    current_index = next((index for index, done in enumerate(completed) if not done), None)
    statuses = []
    for index, done in enumerate(completed):
        if current_index is None:
            statuses.append("done")
        elif index < current_index:
            statuses.append("done")
        elif index == current_index:
            statuses.append("current")
        else:
            statuses.append("upcoming")

    return [
        {
            "title": "Sign-up",
            "date": None,
            "subtitle": (
                f"{signed_up} professors signed up"
                if signed_up
                else "No professors have signed up"
            ),
            "status": statuses[0],
        },
        {
            "title": "Observer selection",
            "date": None,
            "subtitle": (
                "Every sign-up has an observer match"
                if unmatched == 0 and signed_up
                else f"{unmatched} sign-ups still need an observer"
            ),
            "status": statuses[1],
        },
        {
            "title": "Observation",
            "date": None,
            "subtitle": (
                "Every sign-up has an observation report"
                if missing_observations == 0 and signed_up
                else f"{missing_observations} observations still need a report"
            ),
            "status": statuses[2],
        },
        {
            "title": "Survey",
            "date": None,
            "subtitle": (
                "No survey responses are stored for this semester"
                if survey_count == 0
                else f"{survey_count} survey response{'s' if survey_count != 1 else ''} stored"
            ),
            "status": statuses[3],
        },
    ]


def _current_signups(signup_rows, cycle):
    grouped = {}
    for row in signup_rows:
        if row["signup_sem"] != cycle:
            continue
        grouped.setdefault(row["observee_id"], []).append(row)
    return [_signup_record(rows) for rows in grouped.values()]


@dashboard_bp.get("/api/dashboard")
@ac_required
def get_dashboard():
    professors, signup_rows, requests, _courses = _load()
    names = {
        row["professor_id"]: row["professor_name"]
        for row in query_names()
    }
    cycles = sorted(
        {row["signup_sem"] for row in signup_rows if row["signup_sem"]},
        key=_cycle_key,
        reverse=True,
    )
    cycle = cycles[0] if cycles else None
    signups = _current_signups(signup_rows, cycle) if cycle else []
    meeting_ids = {row["meeting_id"] for row in signups if row["meeting_id"] is not None}
    matched_meetings = {
        row["meeting_id"] for row in requests if row["meeting_id"] in meeting_ids
    }
    unmatched_rows = [row for row in signups if row["meeting_id"] not in matched_meetings]
    missing_observations = sum(1 for row in signups if not row["has_report"])

    older = {item for item in cycles if cycle and _cycle_key(item) < _cycle_key(cycle)}
    completed_earlier = set()
    incomplete_earlier = set()
    for row in signup_rows:
        if row["signup_sem"] not in older:
            continue
        key = (row["observee_id"], row["signup_sem"])
        if row["has_report"]:
            completed_earlier.add(key)
        else:
            incomplete_earlier.add(key)
    overdue_ids = {professor_id for professor_id, _semester in incomplete_earlier - completed_earlier}

    ranks = {}
    for professor in professors:
        rank = professor["professor_rank"] or "Unranked"
        ranks.setdefault(
            rank,
            {"hireLevel": rank, "cycle": cycle or "—", "due": 0, "overdue": 0, "outstanding": 0},
        )
        ranks[rank]["due"] += 1
        if professor["professor_id"] in overdue_ids:
            ranks[rank]["overdue"] += 1
    signup_by_id = {row["observee_id"]: row for row in signups}
    for professor in professors:
        signup = signup_by_id.get(professor["professor_id"])
        if signup is None or signup["has_report"]:
            continue
        rank = professor["professor_rank"] or "Unranked"
        ranks[rank]["outstanding"] += 1

    alerts = []
    for row in unmatched_rows:
        course = " ".join(
            part for part in (row["department"], row["course_number"]) if part
        )
        alerts.append({
            "professorName": names.get(row["observee_id"], "—"),
            "course": course or None,
            "courseDay": row["course_day"],
            "courseStartTime": _time_text(row["course_start_time"]),
            "courseEndTime": _time_text(row["course_end_time"]),
        })

    survey_count = 0
    if cycle:
        survey_rows = query(
            "SELECT COUNT(*) AS total FROM feedback WHERE semester = %s",
            (cycle,),
        )
        survey_count = int(survey_rows[0]["total"] or 0)
    steps = _steps(len(signups), len(unmatched_rows), missing_observations, survey_count)
    _apply_cycle_dates(steps, cycle)

    return jsonify(
        cycle=cycle,
        steps=steps,
        hireLevels=sorted(ranks.values(), key=lambda item: item["hireLevel"]),
        alerts=alerts,
    )


def _apply_cycle_dates(steps, semester):
    """Put this semester's evaluation-cycle deadlines on the timeline."""
    if not semester:
        return
    rows = query(
        """
        SELECT signup_deadline, observation_deadline, feedback_deadline
        FROM evaluation_cycles
        WHERE semester = %s
        """,
        (semester,),
    )
    if not rows:
        return
    dates = {
        "Sign-up": calendar_day(rows[0]["signup_deadline"]),
        "Observation": calendar_day(rows[0]["observation_deadline"]),
        "Survey": calendar_day(rows[0]["feedback_deadline"]),
    }
    for step in steps:
        day = dates.get(step["title"])
        if day is not None:
            step["date"] = day.isoformat()


def query_names():
    return query("SELECT professor_id, professor_name FROM professors")


def _time_text(value):
    if value is None:
        return None
    if hasattr(value, "total_seconds"):
        total = int(value.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}:00"
    return str(value)
