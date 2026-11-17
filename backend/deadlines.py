"""Deadline rules for the evaluation cycle.

The three deadlines (sign-up, observation, feedback) are set by the AC on the Cycle Setup page and
stored in the evaluation_cycles table.

To block an endpoint outside its window, add this near the top of the endpoint:

    blocked = deadline_block("send_requests", signup_semester)
    if blocked:
        return blocked

To add or change a rule, edit RULES below. Each rule is one line.
"""

import os
from datetime import datetime, timezone

from flask import g, jsonify

from db import query

DEADLINE_LABELS = {
    "signup_deadline": "Sign-up",
    "observation_deadline": "Observation",
    "feedback_deadline": "Feedback",
}

# action name -> list of (deadline column, when the action is allowed)
#   "before": allowed only until that deadline passes
#   "after":  allowed only once that deadline has passed
RULES = {
    "save_signup_dates": [("signup_deadline", "before")],
    # approving and reopening the AC's observer list wait until sign-up has closed
    "approve_observer_list": [("signup_deadline", "after")],
    # observees can send requests only after sign-up closes and until the observation deadline
    "send_requests": [("signup_deadline", "after"), ("observation_deadline", "before")],
    # observers accepting or declining a request, and the observee confirming one observer
    "respond_to_request": [("observation_deadline", "before")],
    "confirm_observer": [("observation_deadline", "before")],
    # saving and signing the observation form. Tied to the feedback deadline for now; if the team
    # wants this to end with the observation deadline instead, change it here.
    "complete_evaluation": [("feedback_deadline", "before")],
    # the process feedback survey
    "submit_feedback": [("feedback_deadline", "before")],
}

# Accounts that skip every deadline, so the dev account can test the whole flow at any time.
# Override with DEADLINE_BYPASS_USERNAMES (comma separated). Set it to an empty value to turn the
# bypass off. This goes away with the dev account (see "DEV ONLY" in db/02-seed.sql).
DEFAULT_BYPASS_USERNAMES = "dev_user"


def _utcnow():
    """Current time as a naive UTC datetime, the same form the DATETIME columns use."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _bypass_usernames():
    raw = os.getenv("DEADLINE_BYPASS_USERNAMES", DEFAULT_BYPASS_USERNAMES)
    return {name.strip() for name in raw.split(",") if name.strip()}


def _is_bypassed(user_id):
    names = _bypass_usernames()
    if not names or user_id is None:
        return False
    rows = query("SELECT username FROM users WHERE id = %s", (user_id,))
    return bool(rows) and rows[0]["username"] in names


def _cycle(semester):
    rows = query(
        """
        SELECT signup_deadline, observation_deadline, feedback_deadline
        FROM evaluation_cycles
        WHERE semester = %s
        """,
        (semester,),
    )
    return rows[0] if rows else None


def _utc_text(value):
    return value.strftime("%b %d, %Y at %H:%M UTC")


def cycle_days(semester):
    """A semester's deadlines as Central-time calendar days (datetime.date), or None if it has no cycle row.

    Keys: signup, observation, feedback. The deadlines are stored in UTC, so they are converted to the
    day the AC entered on the Cycle Setup page.
    """
    rows = query(
        """
        SELECT
            DATE(COALESCE(CONVERT_TZ(signup_deadline, '+00:00', 'America/Chicago'), signup_deadline)) AS signup,
            DATE(COALESCE(CONVERT_TZ(observation_deadline, '+00:00', 'America/Chicago'), observation_deadline)) AS observation,
            DATE(COALESCE(CONVERT_TZ(feedback_deadline, '+00:00', 'America/Chicago'), feedback_deadline)) AS feedback
        FROM evaluation_cycles
        WHERE semester = %s
        """,
        (semester,),
    )
    return rows[0] if rows else None


def check_deadline(action, semester, now=None):
    """Return None if the action is allowed, or a dict describing the first rule it breaks.

    A semester with no cycle row, or a deadline that is not set, does not block anything.
    """
    if action not in RULES:
        raise ValueError(f"No deadline rule named {action!r}")
    cycle = _cycle(semester)
    if cycle is None:
        return None
    now = now or _utcnow()

    for column, when in RULES[action]:
        deadline = cycle[column]
        if deadline is None:
            continue
        label = DEADLINE_LABELS[column]
        if when == "before" and now >= deadline:
            message = f"{label} closed on {_utc_text(deadline)}."
        elif when == "after" and now < deadline:
            message = f"This is not available until the {label.lower()} deadline passes ({_utc_text(deadline)})."
        else:
            continue
        return {
            "message": message,
            "deadline": column,
            "rule": when,
            "at": deadline.isoformat() + "Z",
        }
    return None


def deadline_block(action, semester):
    """Return a (response, 403) to send back if the action is outside its window, else None."""
    if _is_bypassed(getattr(g, "user_id", None)):
        return None
    problem = check_deadline(action, semester)
    if problem is None:
        return None
    return (
        jsonify(
            error=problem["message"],
            deadline=problem["deadline"],
            rule=problem["rule"],
            at=problem["at"],
        ),
        403,
    )
