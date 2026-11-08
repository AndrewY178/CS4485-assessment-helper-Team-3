"""Auth endpoints:
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password (one-time link sent by EmailJS)
POST /api/auth/reset-password (for both first password + reset)
POST /api/auth/change-password  
POST /api/users (where AC creates accounts)
"""
import hashlib
import os
import secrets
from functools import wraps

from flask import Blueprint, g, jsonify, request
from mysql.connector import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from api_helpers import error, json_body, transaction
from db import query
from emailservice import EmailServiceError, send_email

auth_bp = Blueprint("auth", __name__)

# lifetimes (proposed values)
SESSION_HOURS = 8
SET_PASSWORD_HOURS = 48
RESET_PASSWORD_HOURS = 1
MIN_PASSWORD_LENGTH = 8

# roles an account can be created with. observees rows are created when a professor signs up
# for a cycle, not here, and every professor gets the "Faculty" role (see _roles_for)
ROLE_TABLES = {
    "AC Member": ("assessment_committee", "ac_id"),
}


# helpers (shared ones like error, json_body and transaction live in api_helpers.py)

def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _new_token():
    return secrets.token_urlsafe(32)


def _password_matches(stored_hash, password):
    # a NULL hash (password never set) or a malformed hash never matches
    if not stored_hash:
        return False
    try:
        return check_password_hash(stored_hash, password)
    except ValueError:
        return False


def _roles_for(user_id):
    rows = query(
        """
        SELECT p.professor_id IS NOT NULL AS is_faculty,
               ac.ac_id IS NOT NULL AS is_ac
        FROM users u
        LEFT JOIN professors p ON p.professor_id = u.id
        LEFT JOIN assessment_committee ac ON ac.ac_id = u.id
        WHERE u.id = %s
        """,
        (user_id,),
    )
    row = rows[0] if rows else {}
    roles = []
    if row.get("is_ac"):
        roles.append("AC Member")
    if row.get("is_faculty"):
        roles.append("Faculty")
    return roles


def _issue_password_token(user_id, purpose, hours):
    # create a one-time link token. any older unused link for this user stops working
    query(
        "UPDATE password_tokens SET expires_at = NOW() "
        "WHERE user_id = %s AND used_at IS NULL AND expires_at > NOW()",
        (user_id,),
        fetch=False,
    )
    token = _new_token()
    query(
        "INSERT INTO password_tokens (user_id, token_hash, purpose, expires_at) "
        "VALUES (%s, %s, %s, NOW() + INTERVAL %s HOUR)",
        (user_id, _hash_token(token), purpose, hours),
        fetch=False,
    )
    return token


def _send_password_link(email, token, purpose, hours):
    base = os.getenv("FRONTEND_URL", "http://localhost:5173")
    link = f"{base}/reset-password?token={token}&purpose={purpose}"
    action = "set up" if purpose == "set_password" else "reset"
    message = (
        f"Use this link to {action} your Assessment Helper password:\n\n"
        f"{link}\n\nThis link expires in {hours} hours and can "
        "only be used once."
    )
    send_email(
        email,
        message,
        template_id=os.getenv("EMAILJS_PASSWORD_TEMPLATE_ID") or None,
    )


def _current_session():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[len("Bearer "):].strip()
    if not token:
        return None
    rows = query(
        """
        SELECT s.id AS session_id, s.user_id
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.is_active = TRUE
        """,
        (_hash_token(token),),
    )
    return rows[0] if rows else None


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        session = _current_session()
        if session is None:
            return error("Not logged in", 401)
        g.session_id = session["session_id"]
        g.user_id = session["user_id"]
        return view(*args, **kwargs)
    return wrapped


def ac_required(view):
    @login_required
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "AC Member" not in _roles_for(g.user_id):
            return error("Assessment committee only", 403)
        return view(*args, **kwargs)
    return wrapped


def faculty_required(view):
    @login_required
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "Faculty" not in _roles_for(g.user_id):
            return error("Faculty only", 403)
        return view(*args, **kwargs)
    return wrapped


# endpoints

@auth_bp.post("/api/auth/login")
def login():
    data = json_body()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    if not email or not password:
        return error("Email and password are required", 400)

    rows = query(
        "SELECT id, password_hash, email_verified_at FROM users "
        "WHERE email = %s AND is_active = TRUE",
        (email,),
    )
    user = rows[0] if rows else None
    # unknown email, no password set yet, and wrong password all get the same answer
    if user is None or not _password_matches(user["password_hash"], password):
        return error("Invalid email or password", 401)
    if user["email_verified_at"] is None:
        return error("Verify your email using the link we sent before logging in.", 403)

    token = _new_token()
    query(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, NOW() + INTERVAL %s HOUR)",
        (user["id"], _hash_token(token), SESSION_HOURS),
        fetch=False,
    )
    roles = _roles_for(user["id"])
    # "role" matches the draft API contract (single value); "roles" is the full list
    return jsonify(token=token, role=roles[0] if roles else None, roles=roles, userId=str(user["id"]))


@auth_bp.post("/api/auth/logout")
@login_required
def logout():
    query("UPDATE sessions SET revoked_at = NOW() WHERE id = %s", (g.session_id,), fetch=False)
    return "", 204


@auth_bp.post("/api/auth/forgot-password")
def forgot_password():
    email = (json_body().get("email") or "").strip()
    if not email:
        return error("Email is required", 400)

    rows = query(
        "SELECT id, password_hash, email_verified_at FROM users "
        "WHERE email = %s AND is_active = TRUE",
        (email,),
    )
    if rows:
        user = rows[0]
        purpose = (
            "set_password"
            if user["password_hash"] is None or user["email_verified_at"] is None
            else "reset_password"
        )
        # links requested here always last RESET_PASSWORD_HOURS, so the page can state one
        # exact time without revealing anything about the account
        token = _issue_password_token(user["id"], purpose, RESET_PASSWORD_HOURS)
        try:
            _send_password_link(email, token, purpose, RESET_PASSWORD_HOURS)
        except EmailServiceError:
            return error("Unable to send the email right now. Please try again later.", 502)

    # same answer whether or not the email has an account
    return jsonify(
        message="If that email has an account, a link has been sent.",
        expiresInMinutes=RESET_PASSWORD_HOURS * 60,
    )


@auth_bp.post("/api/auth/reset-password")
def reset_password():
    data = json_body()
    token = data.get("token") or ""
    new_password = data.get("newPassword") or ""
    if not token or not new_password:
        return error("Token and newPassword are required", 400)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return error(f"Password must be at least {MIN_PASSWORD_LENGTH} characters", 400)

    rows = query(
        """
        SELECT t.id AS token_id, t.user_id, t.purpose,
               u.password_hash, u.email_verified_at
        FROM password_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = %s
          AND t.used_at IS NULL
          AND t.expires_at > NOW()
          AND u.is_active = TRUE
        """,
        (_hash_token(token),),
    )
    if not rows:
        return error("This link is invalid or has expired", 400)
    token = rows[0]
    token_id, user_id = token["token_id"], token["user_id"]
    purpose = token["purpose"]
    if purpose == "reset_password" and (
        token["password_hash"] is None or token["email_verified_at"] is None
    ):
        return error("This link is invalid or has expired", 400)

    claimed = False
    with transaction() as cur:
        # claim the token first, so two simultaneous uses cannot both succeed
        cur.execute(
            "UPDATE password_tokens SET used_at = NOW() "
            "WHERE id = %s AND used_at IS NULL AND expires_at > NOW()",
            (token_id,),
        )
        claimed = cur.rowcount == 1
        if claimed:
            if purpose == "set_password":
                cur.execute(
                    "UPDATE users SET password_hash = %s, email_verified_at = NOW() "
                    "WHERE id = %s",
                    (generate_password_hash(new_password), user_id),
                )
            else:
                cur.execute(
                    "UPDATE users SET password_hash = %s WHERE id = %s",
                    (generate_password_hash(new_password), user_id),
                )
            cur.execute("UPDATE sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL", (user_id,))
    if not claimed:
        return error("This link is invalid or has expired", 400)
    return jsonify(
        message=(
            "Email verified and password set"
            if purpose == "set_password"
            else "Password updated"
        ),
        purpose=purpose,
    )


@auth_bp.post("/api/auth/change-password")
@login_required
def change_password():
    data = json_body()
    current = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""
    if not current or not new_password:
        return error("currentPassword and newPassword are required", 400)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return error(f"Password must be at least {MIN_PASSWORD_LENGTH} characters", 400)

    rows = query("SELECT password_hash FROM users WHERE id = %s", (g.user_id,))
    if not rows or not _password_matches(rows[0]["password_hash"], current):
        return error("Current password is incorrect", 400)

    with transaction() as cur:
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (generate_password_hash(new_password), g.user_id))
        # log out every other device, keep this one
        cur.execute(
            "UPDATE sessions SET revoked_at = NOW() WHERE user_id = %s AND id <> %s AND revoked_at IS NULL",
            (g.user_id, g.session_id),
        )
    return jsonify(message="Password updated")


@auth_bp.post("/api/users")
@ac_required
def create_account():
    """AC creates a professor's account (no password yet) and a set-password link is sent."""
    data = json_body()
    email = (data.get("email") or "").strip()
    name = (data.get("name") or "").strip()
    roles = data.get("roles") or []
    username = (data.get("username") or email.split("@")[0]).strip()

    if "@" not in email or not name or not username:
        return error("email and name are required", 400)
    if not isinstance(roles, list) or any(r not in ROLE_TABLES for r in roles):
        return error(f"roles may only contain: {', '.join(ROLE_TABLES)}", 400)

    try:
        with transaction() as cur:
            cur.execute("INSERT INTO users (username, email) VALUES (%s, %s)", (username, email))
            user_id = cur.lastrowid
            cur.execute("INSERT INTO professors (professor_id, professor_name) VALUES (%s, %s)", (user_id, name))
            for role in dict.fromkeys(roles):
                table, column = ROLE_TABLES[role]
                cur.execute(f"INSERT INTO {table} ({column}) VALUES (%s)", (user_id,))
    except IntegrityError:
        return error("An account with that email or username already exists", 409)

    token = _issue_password_token(user_id, "set_password", SET_PASSWORD_HOURS)
    try:
        _send_password_link(email, token, "set_password", SET_PASSWORD_HOURS)
    except EmailServiceError:
        return error("The account was created, but its setup email could not be sent.", 502)
    return jsonify(id=str(user_id), email=email, name=name, roles=_roles_for(user_id)), 201
