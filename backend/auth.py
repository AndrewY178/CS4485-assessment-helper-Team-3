"""Auth endpoints:
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password (one-time link, prints to terminal for now)
POST /api/auth/reset-password (for both first password + reset)
POST /api/auth/change-password  
POST /api/users (where AC creates accounts)
"""
import hashlib
import os
import secrets
from contextlib import contextmanager
from functools import wraps

from flask import Blueprint, g, jsonify, request
from mysql.connector import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from db import pool, query

auth_bp = Blueprint("auth", __name__)

# lifetimes (proposed values)
SESSION_HOURS = 8
SET_PASSWORD_HOURS = 48
RESET_PASSWORD_HOURS = 1
MIN_PASSWORD_LENGTH = 8

# roles come from the professor-subtype tables
ROLE_TABLES = {
    "AC Member": ("assessment_committee", "ac_id"),
    "Observer": ("observers", "observer_id"),
    "Observee": ("observees", "observee_id"),
}


# helpers

def _error(message, status):
    return jsonify(error=message), status


def _body():
    return request.get_json(silent=True) or {}


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


@contextmanager
def _transaction():
    # run several statements as one unit: all succeed or none are saved
    conn = pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        try:
            conn.close()
        except Exception as e:
            print("Exception: " + str(e), flush=True)


def _roles_for(user_id):
    rows = query(
        """
        SELECT ac.ac_id IS NOT NULL AS is_ac,
               obr.observer_id IS NOT NULL AS is_observer,
               obe.observee_id IS NOT NULL AS is_observee
        FROM users u
        LEFT JOIN assessment_committee ac ON ac.ac_id = u.id
        LEFT JOIN observers obr ON obr.observer_id = u.id
        LEFT JOIN observees obe ON obe.observee_id = u.id
        WHERE u.id = %s
        """,
        (user_id,),
    )
    row = rows[0] if rows else {}
    roles = []
    if row.get("is_ac"):
        roles.append("AC Member")
    if row.get("is_observer"):
        roles.append("Observer")
    if row.get("is_observee"):
        roles.append("Observee")
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
    # DEV ONLY: the team has not picked an email service yet, so the one-time link is printed
    # to the terminal. will replace later.
    base = os.getenv("FRONTEND_URL", "http://localhost:5173")
    print(
        f"[DEV EMAIL] to={email} purpose={purpose} expires_in_hours={hours} "
        f"link={base}/reset-password?token={token}",
        flush=True,
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
            return _error("Not logged in", 401)
        g.session_id = session["session_id"]
        g.user_id = session["user_id"]
        return view(*args, **kwargs)
    return wrapped


def ac_required(view):
    @login_required
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "AC Member" not in _roles_for(g.user_id):
            return _error("Assessment committee only", 403)
        return view(*args, **kwargs)
    return wrapped


# endpoints

@auth_bp.post("/api/auth/login")
def login():
    data = _body()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    if not email or not password:
        return _error("Email and password are required", 400)

    rows = query("SELECT id, password_hash FROM users WHERE email = %s AND is_active = TRUE", (email,))
    user = rows[0] if rows else None
    # unknown email, no password set yet, and wrong password all get the same answer
    if user is None or not _password_matches(user["password_hash"], password):
        return _error("Invalid email or password", 401)

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
    email = (_body().get("email") or "").strip()
    if not email:
        return _error("Email is required", 400)

    rows = query("SELECT id, password_hash FROM users WHERE email = %s AND is_active = TRUE", (email,))
    if rows:
        user = rows[0]
        purpose = "set_password" if user["password_hash"] is None else "reset_password"
        # links requested here always last RESET_PASSWORD_HOURS, so the page can state one
        # exact time without revealing anything about the account
        token = _issue_password_token(user["id"], purpose, RESET_PASSWORD_HOURS)
        _send_password_link(email, token, purpose, RESET_PASSWORD_HOURS)

    # same answer whether or not the email has an account
    return jsonify(
        message="If that email has an account, a link has been sent.",
        expiresInMinutes=RESET_PASSWORD_HOURS * 60,
    )


@auth_bp.post("/api/auth/reset-password")
def reset_password():
    data = _body()
    token = data.get("token") or ""
    new_password = data.get("newPassword") or ""
    if not token or not new_password:
        return _error("Token and newPassword are required", 400)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return _error(f"Password must be at least {MIN_PASSWORD_LENGTH} characters", 400)

    rows = query(
        """
        SELECT t.id AS token_id, t.user_id
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
        return _error("This link is invalid or has expired", 400)
    token_id, user_id = rows[0]["token_id"], rows[0]["user_id"]

    claimed = False
    with _transaction() as cur:
        # claim the token first, so two simultaneous uses cannot both succeed
        cur.execute("UPDATE password_tokens SET used_at = NOW() WHERE id = %s AND used_at IS NULL", (token_id,))
        claimed = cur.rowcount == 1
        if claimed:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (generate_password_hash(new_password), user_id))
            cur.execute("UPDATE sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL", (user_id,))
    if not claimed:
        return _error("This link is invalid or has expired", 400)
    return jsonify(message="Password updated")


@auth_bp.post("/api/auth/change-password")
@login_required
def change_password():
    data = _body()
    current = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""
    if not current or not new_password:
        return _error("currentPassword and newPassword are required", 400)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return _error(f"Password must be at least {MIN_PASSWORD_LENGTH} characters", 400)

    rows = query("SELECT password_hash FROM users WHERE id = %s", (g.user_id,))
    if not rows or not _password_matches(rows[0]["password_hash"], current):
        return _error("Current password is incorrect", 400)

    with _transaction() as cur:
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
    data = _body()
    email = (data.get("email") or "").strip()
    name = (data.get("name") or "").strip()
    roles = data.get("roles")
    username = (data.get("username") or email.split("@")[0]).strip()

    if "@" not in email or not name or not username:
        return _error("email and name are required", 400)
    if not isinstance(roles, list) or not roles or any(r not in ROLE_TABLES for r in roles):
        return _error(f"roles must be a non-empty list of: {', '.join(ROLE_TABLES)}", 400)

    try:
        with _transaction() as cur:
            cur.execute("INSERT INTO users (username, email) VALUES (%s, %s)", (username, email))
            user_id = cur.lastrowid
            cur.execute("INSERT INTO professors (professor_id, professor_name) VALUES (%s, %s)", (user_id, name))
            for role in dict.fromkeys(roles):
                table, column = ROLE_TABLES[role]
                cur.execute(f"INSERT INTO {table} ({column}) VALUES (%s)", (user_id,))
    except IntegrityError:
        return _error("An account with that email or username already exists", 409)

    token = _issue_password_token(user_id, "set_password", SET_PASSWORD_HOURS)
    _send_password_link(email, token, "set_password", SET_PASSWORD_HOURS)
    return jsonify(id=str(user_id), email=email, name=name, roles=list(dict.fromkeys(roles))), 201
