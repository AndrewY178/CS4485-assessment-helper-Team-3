"""Reusable EmailJS delivery helpers."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send"
EMAILJS_TIMEOUT_SECONDS = 15


class EmailServiceError(RuntimeError):
    """Raised when an email cannot be sent through EmailJS."""


def _setting(name, vite_name=None):
    value = os.getenv(name)
    if not value and vite_name:
        value = os.getenv(vite_name)
    return value.strip() if value else ""


def send_email(to_email, message, *, to_name="", template_id=None):
    """Send an email using an EmailJS template with to_email/to_name/message fields."""
    service_id = _setting("EMAILJS_SERVICE_ID", "VITE_EMAILJS_SERVICE_ID")
    public_key = _setting("EMAILJS_PUBLIC_KEY", "VITE_EMAILJS_PUBLIC_KEY")
    selected_template_id = (
        template_id
        or _setting("EMAILJS_TEMPLATE_ID", "VITE_EMAILJS_TEMPLATE_ID")
    )

    missing = [
        name
        for name, value in (
            ("EMAILJS_SERVICE_ID", service_id),
            ("EMAILJS_TEMPLATE_ID", selected_template_id),
            ("EMAILJS_PUBLIC_KEY", public_key),
        )
        if not value
    ]
    if missing:
        raise EmailServiceError(
            "EmailJS configuration is missing: " + ", ".join(missing)
        )
    if not to_email.strip():
        raise ValueError("to_email is required")

    payload = {
        "service_id": service_id,
        "template_id": selected_template_id,
        "user_id": public_key,
        "template_params": {
            "to_email": to_email.strip(),
            "to_name": to_name,
            "message": message,
        },
    }
    request = Request(
        EMAILJS_SEND_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=EMAILJS_TIMEOUT_SECONDS) as response:
            if not 200 <= response.status < 300:
                raise EmailServiceError(
                    f"EmailJS returned HTTP status {response.status}"
                )
    except HTTPError as exc:
        raise EmailServiceError(
            f"EmailJS returned HTTP status {exc.code}"
        ) from exc
    except (TimeoutError, URLError) as exc:
        raise EmailServiceError("Could not reach EmailJS") from exc
