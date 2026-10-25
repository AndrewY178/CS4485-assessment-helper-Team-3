import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

pool = pooling.MySQLConnectionPool(
    pool_name="coursebook_pool",
    pool_size=5,
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", 3306)),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
)

def query(sql, params=None, fetch=True):
    """Run a query. Returns rows (as dicts) for SELECTs, or the last inserted id / row count otherwise."""
    conn = pool.get_connection()
    cursor = None

    try:
        conn.ping(reconnect=True, attempts=3, delay=1)
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params or ())
        if fetch:
            return cursor.fetchall()
        conn.commit()
        return cursor.lastrowid or cursor.rowcount
    finally:
        if cursor is not None:
            cursor.close()
        if conn:
            try:
                conn.close()
            except Exception as e:
                print("Exception: " + str(e), flush=True)
