"""Assessment-cycle reminder delivery."""

import os
import time

from flask import Blueprint, jsonify

from api_helpers import error
from auth import ac_required
from db import query
from emailservice import EmailServiceError, send_email

reminders_bp = Blueprint("reminders", __name__)

EMAILJS_RATE_LIMIT_SECONDS = 1.1


def _in_test_mode():
    value = os.getenv("REMINDER_TEST_MODE", "true").strip().lower()
    if value not in {"true", "false", "1", "0", "yes", "no"}:
        raise EmailServiceError("REMINDER_TEST_MODE must be set to true or false")
    return value in {"true", "1", "yes"}


def _reminder_candidates():
    cycles = query(
        """
        SELECT DISTINCT signup_sem
        FROM observees
        WHERE signup_sem IS NOT NULL
        ORDER BY
            CAST(SUBSTRING_INDEX(signup_sem, ' ', -1) AS UNSIGNED) DESC,
            FIELD(SUBSTRING_INDEX(signup_sem, ' ', 1), 'Spring', 'Summer', 'Fall') DESC
        LIMIT 2
        """
    )
    if not cycles:
        return []

    current_cycle = cycles[0]["signup_sem"]
    cycle_labels = [current_cycle]
    if len(cycles) > 1:
        cycle_labels.append(cycles[1]["signup_sem"])

    meeting_columns = {
        row["Field"] for row in query("SHOW COLUMNS FROM meetings")
    }
    if "course_id" in meeting_columns:
        report_course_match = "m.course_id = c.course_id"
    else:
        report_course_match = """
            m.semester = c.semester
            AND m.department = c.department
            AND m.course_number = c.course_number
            AND m.section_number = c.section_number
        """

    placeholders = ", ".join(["%s"] * len(cycle_labels))
    rows = query(
        f"""
        SELECT u.id AS user_id, p.professor_name AS name, u.email, o.signup_sem
        FROM observees o
        JOIN professors p ON p.professor_id = o.observee_id
        JOIN users u ON u.id = o.observee_id
        LEFT JOIN courses c
            ON c.course_id = o.signup_course
            OR (
                o.signup_course IS NULL
                AND c.prof_id = o.observee_id
                AND c.semester = o.signup_sem
            )
        WHERE o.signup_sem IN ({placeholders})
          AND u.is_active = TRUE
          AND u.email IS NOT NULL
          AND TRIM(u.email) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM meetings m
              JOIN reports r ON r.meeting_id = m.meeting_id
              WHERE c.course_id IS NOT NULL
                AND {report_course_match}
          )
        ORDER BY p.professor_name, o.signup_sem
        """,
        tuple(cycle_labels),
    )

    # A person with more than one incomplete cycle gets one email. An older
    # incomplete evaluation takes priority so it is clearly marked overdue.
    by_user = {}
    for row in rows:
        candidate = {
            "user_id": row["user_id"],
            "name": row["name"],
            "email": row["email"].strip(),
            "cycle": row["signup_sem"],
            "status": "Due" if row["signup_sem"] == current_cycle else "Overdue",
        }
        existing = by_user.get(row["user_id"])
        if existing is None or candidate["status"] == "Overdue":
            by_user[row["user_id"]] = candidate

    return list(by_user.values())


def _reminder_message(candidate, *, test_mode, app_url):
    status = candidate["status"]
    if status == "Overdue":
        detail = (
            f"Our records show that your faculty evaluation for "
            f"{candidate['cycle']} is overdue and remains incomplete."
        )
    else:
        detail = (
            f"Our records show that your faculty evaluation for "
            f"{candidate['cycle']} is due."
        )

    testing_note = ""
    if test_mode:
        testing_note = (
            "TEST MESSAGE: This personalized reminder is intended for "
            f"{candidate['name']} <{candidate['email']}> and was routed to "
            "the configured test inbox.\n\n"
        )

    return (
        f"{testing_note}"
        f"Hello {candidate['name']},\n\n"
        f"{detail}\n\n"
        f"Please log in to Assessment Helper at {app_url}/login to review "
        "your evaluation status and any required next steps.\n\n"
        "If you believe this status is incorrect, please contact your "
        "Assessment Committee.\n\n"
        "Assessment Helper"
    )


@reminders_bp.post("/api/reminders")
@ac_required
def send_reminders():
    candidates = []
    sent_count = 0
    try:
        candidates = _reminder_candidates()
        if not candidates:
            return jsonify(sentCount=0, recipientCount=0, testMode=False)

        test_mode = _in_test_mode()
        test_recipient = (
            os.getenv("EMAILJS_TEST_RECIPIENT")
            or os.getenv("VITE_EMAILJS_TEST_RECIPIENT")
            or ""
        ).strip()
        if test_mode and not test_recipient:
            return error(
                "Reminder test mode is enabled, but no test inbox is configured.",
                500,
            )
        app_url = (os.getenv("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
        template_id = os.getenv("EMAILJS_REMINDER_TEMPLATE_ID") or None
        template_id = os.getenv("EMAILJS_REMINDER_TEMPLATE_ID") or None
        for candidate in candidates:
            if sent_count:
                time.sleep(EMAILJS_RATE_LIMIT_SECONDS)
            send_email(
                test_recipient if test_mode else candidate["email"],
                _reminder_message(candidate, test_mode=test_mode, app_url=app_url),
                to_name=candidate["name"],
                template_id=template_id,
            )
            sent_count += 1
    except EmailServiceError as exc:
        if sent_count:
            return error(
                f"Email delivery stopped after {sent_count} of "
                f"{len(candidates)} reminders. Review delivered emails before "
                "retrying.",
                502,
            )
        return error(str(exc), 502)

    return jsonify(
        sentCount=sent_count,
        recipientCount=len(candidates),
        testMode=test_mode,
    )
