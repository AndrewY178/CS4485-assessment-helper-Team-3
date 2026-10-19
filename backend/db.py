import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

pool = pooling.MySQLConnectionPool(
    pool_name="class_pool",
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
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params or ())
        if fetch:
            return cursor.fetchall()
        conn.commit()
        return cursor.lastrowid or cursor.rowcount
    finally:
        cursor.close()
        conn.close()
