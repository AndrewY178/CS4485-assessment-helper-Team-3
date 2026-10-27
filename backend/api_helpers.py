"""Small helpers shared by API routes. Any route file can import these."""
from contextlib import contextmanager

from flask import jsonify, request

from db import pool


def error(message, status):
    """JSON error reply, e.g. return error("Not logged in", 401)."""
    return jsonify(error=message), status


def json_body():
    """The request's JSON body as a dict ({} if there is none or it is invalid)."""
    return request.get_json(silent=True) or {}


@contextmanager
def transaction():
    """Run several statements as one unit: all succeed or none are saved.

    with transaction() as cur:
        cur.execute(...)
        cur.execute(...)
    """
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
