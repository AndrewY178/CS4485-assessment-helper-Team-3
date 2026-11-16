"""AC dashboard and cycle KPI calculations. Read-only."""

from flask import Blueprint, jsonify

from auth import ac_required
from db import query

kpis_bp = Blueprint("kpis", __name__)

SEASONS = {"Spring": 1, "Summer": 2, "Fall": 3}
SENT_STATUSES = {
    "pending",
    "accepted",
    "declined",
    "confirmed",
    "not_selected",
    "expired",
}
DAY_CODES = ("M", "T", "W", "R", "F")


def _cycle_key(label):
    parts = str(label or "").split()
    if len(parts) != 2 or not parts[1].isdigit():
        return (0, 0)
    return (int(parts[1]), SEASONS.get(parts[0], 0))


def _level(course_number):
    text = str(course_number or "").strip()
    if not text or not text[0].isdigit():
        return None
    return f"{text[0]}000"


def _minutes(value):
    if value is None:
        return None
    if hasattr(value, "total_seconds"):
        return int(value.total_seconds() // 60)
    parts = str(value).split(":")
    if len(parts) < 2:
        return None
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return None


def _schedule_conflict(target, courses):
    target_start = _minutes(target.get("course_start_time"))
    target_end = _minutes(target.get("course_end_time"))
    target_days = target.get("course_day") or ""
    if target_start is None or target_end is None or not target_days:
        return False
    for course in courses:
        if course.get("semester") != target.get("semester"):
            continue
        other_days = course.get("course_day") or ""
        if not any(day in target_days and day in other_days for day in DAY_CODES):
            continue
        start = _minutes(course.get("course_start_time"))
        end = _minutes(course.get("course_end_time"))
        if start is None or end is None:
            continue
        if start < target_end and end > target_start:
            return True
    return False


def _rate(numerator, denominator):
    if not denominator:
        return None
    return numerator / denominator


def _surveys_stored():
    rows = query("SHOW TABLES")
    names = {str(next(iter(row.values()))).lower() for row in rows}
    return bool(names & {"surveys", "survey_responses", "feedback"})


def _load():
    professors = query(
        """
        SELECT professor_id, professor_rank
        FROM professors
        """
    )
    signups = query(
        """
        SELECT
            o.observee_id,
            o.signup_sem,
            c.department,
            c.course_number,
            c.semester,
            c.course_day,
            c.course_start_time,
            c.course_end_time,
            m.meeting_id,
            m.observer_id AS assigned_observer,
            m.meeting_date,
            r.meeting_id IS NOT NULL AS has_report
        FROM observees o
        LEFT JOIN courses c ON c.course_id = o.signup_course
        LEFT JOIN meetings m ON m.course_id = o.signup_course
        LEFT JOIN reports r ON r.meeting_id = m.meeting_id
        """
    )
    requests = query(
        """
        SELECT
            ob_r.meeting_id,
            ob_r.observer_id,
            ob_r.status,
            ob_r.sent_at
        FROM observation_requests ob_r
        """
    )
    taught = query(
        """
        SELECT
            prof_id,
            department,
            course_number,
            semester,
            course_day,
            course_start_time,
            course_end_time
        FROM courses
        """
    )
    courses_by_prof = {}
    for course in taught:
        courses_by_prof.setdefault(course["prof_id"], []).append(course)
    return professors, signups, requests, courses_by_prof


def _signup_record(rows):
    """One sign-up row. Prefer a completed report, then an assigned observer."""
    chosen = rows[0]
    for row in rows:
        if row["has_report"]:
            chosen = row
            break
        if chosen["assigned_observer"] is None and row["assigned_observer"] is not None:
            chosen = row
    if any(row["has_report"] for row in rows):
        chosen = dict(chosen)
        chosen["has_report"] = 1
    return chosen


def _cycle_metrics(cycle, professors, signup_rows, requests, courses_by_prof, all_cycles):
    grouped = {}
    for row in signup_rows:
        if row["signup_sem"] != cycle:
            continue
        grouped.setdefault(row["observee_id"], []).append(row)
    signups = [_signup_record(rows) for rows in grouped.values()]
    signup_ids = {row["observee_id"] for row in signups}
    meeting_ids = {row["meeting_id"] for row in signups if row["meeting_id"] is not None}
    by_meeting = {row["meeting_id"]: row for row in signups if row["meeting_id"] is not None}

    cycle_requests = [row for row in requests if row["meeting_id"] in meeting_ids]
    requests_by_meeting = {}
    for row in cycle_requests:
        requests_by_meeting.setdefault(row["meeting_id"], []).append(row)

    due = len(professors)
    signed_up = len(signups)
    ranks = {}
    for professor in professors:
        rank = professor["professor_rank"] or "Unranked"
        ranks.setdefault(rank, {"rank": rank, "due": 0, "signedUp": 0})
        ranks[rank]["due"] += 1
    for row in signups:
        professor = next(
            (item for item in professors if item["professor_id"] == row["observee_id"]),
            None,
        )
        rank = (professor or {}).get("professor_rank") or "Unranked"
        ranks.setdefault(rank, {"rank": rank, "due": 0, "signedUp": 0})
        ranks[rank]["signedUp"] += 1

    older_cycles = {item for item in all_cycles if _cycle_key(item) < _cycle_key(cycle)}
    completed_earlier = set()
    incomplete_earlier = set()
    for row in signup_rows:
        if row["signup_sem"] not in older_cycles:
            continue
        key = (row["observee_id"], row["signup_sem"])
        if row["has_report"]:
            completed_earlier.add(key)
        else:
            incomplete_earlier.add(key)
    overdue_ids = {professor_id for professor_id, _semester in incomplete_earlier - completed_earlier}

    eligible = 0
    same_professor = 0
    other_department = 0
    different_level = 0
    schedule_conflict = 0
    for request_row in cycle_requests:
        target = by_meeting.get(request_row["meeting_id"])
        if target is None:
            continue
        observer_courses = courses_by_prof.get(request_row["observer_id"], [])
        target_level = _level(target["course_number"])
        same_level_courses = [
            course
            for course in observer_courses
            if course.get("semester") == target.get("semester")
            and _level(course["course_number"]) == target_level
            and target_level is not None
        ]
        same_department = any(
            course["department"] == target["department"] for course in same_level_courses
        )
        is_self = request_row["observer_id"] == target["observee_id"]
        wrong_level = not same_level_courses
        wrong_department = bool(same_level_courses) and not same_department
        conflict = _schedule_conflict(target, observer_courses)
        if is_self:
            same_professor += 1
        if wrong_level:
            different_level += 1
        if wrong_department:
            other_department += 1
        if conflict:
            schedule_conflict += 1
        if not is_self and same_department and not wrong_level and not conflict:
            eligible += 1

    observed = {
        row["assigned_observer"]
        for row in signups
        if row["assigned_observer"] is not None and row["meeting_date"] is not None
    }
    match_meetings = {row["meeting_id"] for row in cycle_requests}
    unmatched = sum(1 for row in signups if row["meeting_id"] not in match_meetings)

    outstanding = 0
    did_not_go_through = 0
    observed_after_request = 0
    for row in signups:
        meeting_requests = requests_by_meeting.get(row["meeting_id"], [])
        sent = [
            item
            for item in meeting_requests
            if item["status"] in SENT_STATUSES and item["sent_at"] is not None
        ]
        was_observed = row["assigned_observer"] is not None and row["meeting_date"] is not None
        if sent and was_observed:
            observed_after_request += 1
        if row["has_report"]:
            continue
        if was_observed:
            outstanding += 1
        elif sent:
            did_not_go_through += 1

    match_count = len(cycle_requests)
    return {
        "cycle": cycle,
        "due": due,
        "signedUp": signed_up,
        "participationRate": _rate(signed_up, due),
        "overdue": len(overdue_ids),
        "unmatched": unmatched,
        "eligibility": {
            "eligible": eligible,
            "total": len(cycle_requests),
            "rate": _rate(eligible, len(cycle_requests)),
            "sameProfessor": same_professor,
            "otherDepartment": other_department,
            "differentLevel": different_level,
            "scheduleConflict": schedule_conflict,
        },
        "observerUtilization": {
            "observed": len(observed),
            "signedUp": signed_up,
            "rate": _rate(len(observed), signed_up),
        },
        "listSufficiency": {
            "matches": match_count,
            "signups": signed_up,
            "average": _rate(match_count, signed_up),
        },
        "missingObservations": outstanding + did_not_go_through,
        "outstandingReports": outstanding,
        "didNotGoThrough": did_not_go_through,
        "survey": {
            "completed": 0,
            "reachedSurvey": observed_after_request,
            "rate": _rate(0, observed_after_request),
            "surveysStored": False,
        },
        "byRank": [
            {
                "rank": item["rank"],
                "due": item["due"],
                "signedUp": item["signedUp"],
                "rate": _rate(item["signedUp"], item["due"]),
            }
            for item in sorted(ranks.values(), key=lambda item: item["rank"])
        ],
    }


@kpis_bp.get("/api/kpis")
@ac_required
def get_kpis():
    professors, signup_rows, requests, courses_by_prof = _load()
    cycles = sorted(
        {row["signup_sem"] for row in signup_rows if row["signup_sem"]},
        key=_cycle_key,
        reverse=True,
    )
    surveys_stored = _surveys_stored()
    metrics = []
    for cycle in cycles:
        item = _cycle_metrics(
            cycle, professors, signup_rows, requests, courses_by_prof, cycles
        )
        item["survey"]["surveysStored"] = surveys_stored
        metrics.append(item)
    return jsonify(cycles=metrics)
