"""In-app notification storage and API endpoints."""

from flask import Blueprint, g, jsonify

from api_helpers import error, json_body, transaction
from auth import ac_required, login_required
from db import query
from emailservice import EmailServiceError, send_email

notifications_bp = Blueprint("notifications", __name__)

MAX_TITLE_LENGTH = 150
MAX_MESSAGE_LENGTH = 5000


def create_notifications(recipient_ids, title, message, sender_id=None):
    """Create one notification per recipient within a single transaction."""
    with transaction() as cursor:
        return insert_notifications(
            cursor, recipient_ids, title, message, sender_id
        )


def insert_notifications(cursor, recipient_ids, title, message, sender_id=None):
    """Insert notifications using an existing transaction cursor."""
    recipients = list(dict.fromkeys(recipient_ids))
    if not recipients:
        return 0

    cursor.executemany(
        """
        INSERT INTO notifications (recipient_id, sender_id, title, message)
        VALUES (%s, %s, %s, %s)
        """,
        [(recipient_id, sender_id, title, message) for recipient_id in recipients],
    )
    return len(recipients)


def create_notification(recipient_id, title, message, sender_id=None):
    """Create a single in-app notification for use by other backend features."""
    return create_notifications([recipient_id], title, message, sender_id)


def send_notification_email(email, message, *, name=""):
    if not email or not email.strip():
        return {"email_sent": False, "email_error": "Recipient email is missing"}

    try:
        send_email(email, message, to_name=name or "")
    except EmailServiceError as exc:
        return {"email_sent": False, "email_error": str(exc)}
    return {"email_sent": True, "email_error": None}


def _active_faculty(user_ids=None):
    sql = """
        SELECT u.id AS user_id, p.professor_name AS name, u.email
        FROM users u
        JOIN professors p ON p.professor_id = u.id
        WHERE u.is_active = TRUE
    """
    params = ()
    if user_ids is not None:
        placeholders = ", ".join(["%s"] * len(user_ids))
        sql += f" AND u.id IN ({placeholders})"
        params = tuple(user_ids)
    sql += " ORDER BY p.professor_name"
    return query(sql, params)


@notifications_bp.get("/api/notifications")
@login_required
def get_notifications():
    rows = query(
        """
        SELECT n.id, n.title, n.message,
               CAST(n.created_at AS CHAR) AS created_at,
               COALESCE(p.professor_name, 'Assessment Committee') AS sender_name
        FROM notifications n
        LEFT JOIN professors p ON p.professor_id = n.sender_id
        WHERE n.recipient_id = %s
          AND n.dismissed_at IS NULL
        ORDER BY n.created_at DESC, n.id DESC
        """,
        (g.user_id,),
    )
    return jsonify(rows)


@notifications_bp.get("/api/notifications/unread-count")
@login_required
def get_unread_notification_count():
    rows = query(
        """
        SELECT COUNT(*) AS unread_count
        FROM notifications
        WHERE recipient_id = %s
          AND read_at IS NULL
          AND dismissed_at IS NULL
        """,
        (g.user_id,),
    )
    return jsonify(unreadCount=int(rows[0]["unread_count"]))


@notifications_bp.patch("/api/notifications/read")
@login_required
def mark_notifications_read():
    query(
        """
        UPDATE notifications
        SET read_at = CURRENT_TIMESTAMP
        WHERE recipient_id = %s
          AND read_at IS NULL
          AND dismissed_at IS NULL
        """,
        (g.user_id,),
        fetch=False,
    )
    return jsonify(message="Notifications marked as read")


@notifications_bp.get("/api/notifications/recipients")
@ac_required
def get_notification_recipients():
    return jsonify(_active_faculty())


@notifications_bp.post("/api/notifications")
@ac_required
def send_notification():
    data = json_body()
    if not isinstance(data, dict):
        return error("A JSON object is required", 400)
    title = data.get("title")
    message = data.get("message")
    all_faculty = data.get("allFaculty", False)
    user_ids = data.get("userIds")

    if not isinstance(title, str) or not title.strip():
        return error("A notification title is required", 400)
    if len(title.strip()) > MAX_TITLE_LENGTH:
        return error(f"Title must be {MAX_TITLE_LENGTH} characters or fewer", 400)
    if not isinstance(message, str) or not message.strip():
        return error("A notification message is required", 400)
    if len(message.strip()) > MAX_MESSAGE_LENGTH:
        return error(f"Message must be {MAX_MESSAGE_LENGTH} characters or fewer", 400)
    if not isinstance(all_faculty, bool):
        return error("allFaculty must be a boolean", 400)
    if all_faculty and user_ids not in (None, []):
        return error("Choose all faculty or selected recipients, not both", 400)

    if all_faculty:
        recipients = _active_faculty()
    else:
        if (
            not isinstance(user_ids, list)
            or not user_ids
            or any(type(user_id) is not int or user_id < 1 for user_id in user_ids)
        ):
            return error("Select at least one valid faculty recipient", 400)
        requested_ids = list(dict.fromkeys(user_ids))
        recipients = _active_faculty(requested_ids)
        if len(recipients) != len(requested_ids):
            return error("One or more selected faculty members were not found", 400)

    if not recipients:
        return error("There are no active faculty recipients", 400)

    recipient_count = create_notifications(
        [recipient["user_id"] for recipient in recipients],
        title.strip(),
        message.strip(),
        g.user_id,
    )
    return jsonify(message="Notification sent", recipientCount=recipient_count), 201


@notifications_bp.patch("/api/notifications/<int:notification_id>/dismiss")
@login_required
def dismiss_notification(notification_id):
    query(
        """
        UPDATE notifications
        SET dismissed_at = CURRENT_TIMESTAMP
        WHERE id = %s AND recipient_id = %s AND dismissed_at IS NULL
        """,
        (notification_id, g.user_id),
        fetch=False,
    )
    if query(
        "SELECT id FROM notifications WHERE id = %s AND recipient_id = %s",
        (notification_id, g.user_id),
    ):
        return jsonify(message="Notification dismissed")
    return error("Notification not found", 404)
