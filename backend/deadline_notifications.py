"""Scheduled inbox and email notifications for evaluation deadlines."""

import os
import time
from datetime import datetime, timedelta

from mysql.connector import Error as MySQLError
from db import query, transaction
from emailservice import EmailServiceError, send_email
from notifications import insert_notifications

EMAILJS_RATE_LIMIT_SECONDS = 1.1


def _feedback_recipients(semester):
    return query(
        """
        SELECT DISTINCT u.id AS user_id, p.professor_name AS name, u.email
        FROM users u
        JOIN professors p ON p.professor_id = u.id
        WHERE u.is_active = TRUE
          AND (
              EXISTS (
                  SELECT 1
                  FROM observees o
                  WHERE o.observee_id = u.id AND o.signup_sem = %s
              )
              OR EXISTS (
                  SELECT 1
                  FROM observation_requests r
                  JOIN meetings m ON m.meeting_id = r.meeting_id
                  JOIN courses c ON c.course_id = m.course_id
                  WHERE r.observer_id = u.id
                    AND r.status = 'confirmed'
                    AND c.semester = %s
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM feedback f
              WHERE f.professor_id = u.id AND f.semester = %s
          )
        ORDER BY p.professor_name
        """,
        (semester, semester, semester),
    )


def _ac_recipients():
    return query(
        """
        SELECT ac.ac_id AS user_id, p.professor_name AS name, u.email
        FROM assessment_committee ac
        JOIN professors p ON p.professor_id = ac.ac_id
        JOIN users u ON u.id = ac.ac_id
        WHERE u.is_active = TRUE
        ORDER BY p.professor_name
        """
    )


def _deadline_key(now, deadline, phase):
    if deadline.date() < now.date():
        return None
    if deadline.date() == now.date():
        return f"ac_{phase}_deadline"
    if now >= deadline - timedelta(days=1):
        return f"ac_{phase}_1_day"
    if now >= deadline - timedelta(days=7):
        return f"ac_{phase}_7_days"
    return None


def _due_reminder_keys(now, observation_deadline, feedback_deadline):
    if observation_deadline > now or feedback_deadline.date() < now.date():
        return []
    keys = ["feedback_open"]
    if now >= feedback_deadline.replace(
        hour=0, minute=0, second=0, microsecond=0
    ):
        keys.append("feedback_deadline")
    elif now >= feedback_deadline - timedelta(days=1):
        keys.append("feedback_1_day")
    elif now >= feedback_deadline - timedelta(days=7):
        keys.append("feedback_7_days")
    return keys


def _notification_text(reminder_key, semester):
    if reminder_key == "feedback_open":
        return (
            f"Feedback is now open for {semester}. Complete the Assessment Helper "
            "feedback survey before the feedback deadline."
        )
    if reminder_key == "feedback_7_days":
        return f"Your {semester} feedback survey is due in 7 days. Please submit it in Assessment Helper."
    if reminder_key == "feedback_1_day":
        return f"Your {semester} feedback survey is due tomorrow. Please submit it in Assessment Helper."
    if reminder_key == "feedback_deadline":
        return f"Your {semester} feedback survey is due today. Please submit it in Assessment Helper."

    phase = reminder_key.removeprefix("ac_")
    phase, timing = phase.rsplit("_", 1) if phase.endswith("deadline") else (
        phase.rsplit("_", 2)[0],
        "_".join(phase.rsplit("_", 2)[1:]),
    )
    phase_label = phase.replace("_", " ")
    if timing == "7_days":
        due_text = "is in 7 days"
    elif timing == "1_day":
        due_text = "is tomorrow"
    else:
        due_text = "is today"
    return f"The {phase_label} deadline for {semester} {due_text}."


def _title(reminder_key, semester):
    if reminder_key == "feedback_open":
        label = "Feedback survey open"
    elif reminder_key == "feedback_7_days":
        label = "Feedback due in 7 days"
    elif reminder_key == "feedback_1_day":
        label = "Feedback due tomorrow"
    elif reminder_key == "feedback_deadline":
        label = "Feedback due today"
    else:
        parts = reminder_key.removeprefix("ac_").split("_")
        timing = "_".join(parts[-2:]) if parts[-1] in {"days", "day"} else parts[-1]
        phase = " ".join(parts[:-2] if timing in {"7_days", "1_day"} else parts[:-1])
        labels = {
            "7_days": "in 7 days",
            "1_day": "tomorrow",
            "deadline": "today",
        }
        label = f"{phase.title()} deadline {labels[timing]}"
    return f"{label} — {semester}"


def _enqueue(semester, recipient, reminder_key, title, message):
    def insert_delivery(cur):
        cur.execute(
            """
            INSERT IGNORE INTO deadline_notification_deliveries
                (semester, recipient_id, reminder_key, title, message)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (semester, recipient["user_id"], reminder_key, title, message),
        )
        if cur.rowcount != 1:
            return False
        insert_notifications(
            cur, [recipient["user_id"]], title, message, sender_id=None
        )
        return True

    return transaction(insert_delivery)


def enqueue_due_deadline_notifications(now=None):
    now = now or datetime.utcnow()
    cycles = query(
        """
        SELECT semester, signup_deadline, observation_deadline, feedback_deadline
        FROM evaluation_cycles
        WHERE cycle_status <> 'closed'
        """
    )
    created = 0
    ac_recipients = _ac_recipients()
    for cycle in cycles:
        for phase in ("signup", "observation", "feedback"):
            reminder_key = _deadline_key(
                now, cycle[f"{phase}_deadline"], phase
            )
            if reminder_key is None:
                continue
            title = _title(reminder_key, cycle["semester"])
            message = _notification_text(reminder_key, cycle["semester"])
            for recipient in ac_recipients:
                if _enqueue(
                    cycle["semester"], recipient, reminder_key, title, message
                ):
                    created += 1

        recipients = _feedback_recipients(cycle["semester"])
        reminder_keys = _due_reminder_keys(
            now, cycle["observation_deadline"], cycle["feedback_deadline"]
        )
        for reminder_key in reminder_keys:
            title = _title(reminder_key, cycle["semester"])
            message = _notification_text(reminder_key, cycle["semester"])
            for recipient in recipients:
                if _enqueue(
                    cycle["semester"], recipient, reminder_key, title, message
                ):
                    created += 1
    return created


def deliver_pending_deadline_emails(limit=50):
    pending = query(
        """
        SELECT d.id, d.message, d.recipient_id, p.professor_name AS name,
               u.email
        FROM deadline_notification_deliveries d
        JOIN users u ON u.id = d.recipient_id
        JOIN professors p ON p.professor_id = d.recipient_id
        WHERE d.email_sent_at IS NULL
          AND (
              d.last_email_attempt_at IS NULL
              OR d.last_email_attempt_at < UTC_TIMESTAMP() - INTERVAL 15 MINUTE
          )
        ORDER BY d.id
        LIMIT %s
        """,
        (limit,),
    )
    test_mode_value = os.getenv("REMINDER_TEST_MODE", "true").strip().lower()
    if test_mode_value not in {"true", "false", "1", "0", "yes", "no"}:
        raise EmailServiceError("REMINDER_TEST_MODE must be set to true or false")
    test_mode = test_mode_value in {"true", "1", "yes"}
    test_recipient = (
        os.getenv("EMAILJS_TEST_RECIPIENT")
        or os.getenv("VITE_EMAILJS_TEST_RECIPIENT")
        or ""
    ).strip()
    if test_mode and not test_recipient:
        raise EmailServiceError(
            "Reminder test mode is enabled, but no test inbox is configured."
        )
    app_url = (os.getenv("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    template_id = os.getenv("EMAILJS_REMINDER_TEMPLATE_ID") or None

    sent = 0
    for index, row in enumerate(pending):
        if index:
            time.sleep(EMAILJS_RATE_LIMIT_SECONDS)
        email_message = (
            f"{row['message']}\n\nLog in to Assessment Helper: {app_url}/login"
        )
        if test_mode:
            email_message = (
                "TEST MESSAGE: this reminder is intended for "
                f"{row['name']} <{row['email']}> and was routed to the configured test inbox.\n\n"
                f"{email_message}"
            )
        try:
            send_email(
                test_recipient if test_mode else row["email"],
                email_message,
                to_name=row["name"] or "",
                template_id=template_id,
            )
        except EmailServiceError as exc:
            query(
                """
                UPDATE deadline_notification_deliveries
                SET email_attempts = email_attempts + 1,
                    last_email_attempt_at = UTC_TIMESTAMP(),
                    last_email_error = %s
                WHERE id = %s AND email_sent_at IS NULL
                """,
                (str(exc), row["id"]),
                fetch=False,
            )
            print(
                f"Deadline notification email failed for delivery {row['id']}: {exc}",
                flush=True,
            )
            continue

        query(
            """
            UPDATE deadline_notification_deliveries
            SET email_sent_at = UTC_TIMESTAMP(),
                email_attempts = email_attempts + 1,
                last_email_attempt_at = UTC_TIMESTAMP(),
                last_email_error = NULL
            WHERE id = %s AND email_sent_at IS NULL
            """,
            (row["id"],),
            fetch=False,
        )
        sent += 1
    return sent


def run_deadline_notification_cycle():
    created = enqueue_due_deadline_notifications()
    sent = deliver_pending_deadline_emails()
    return created, sent


def run_deadline_notification_worker():
    interval = int(os.getenv("DEADLINE_WORKER_INTERVAL_SECONDS", "60"))
    if interval < 10:
        raise ValueError("DEADLINE_WORKER_INTERVAL_SECONDS must be at least 10")
    while True:
        try:
            created, sent = run_deadline_notification_cycle()
            if created or sent:
                print(
                    f"Deadline notifications: {created} inbox messages created, "
                    f"{sent} emails sent.",
                    flush=True,
                )
        except (MySQLError, EmailServiceError, ValueError) as exc:
            print(f"Deadline notification cycle failed: {exc}", flush=True)
        time.sleep(interval)
