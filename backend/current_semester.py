"""Determine the academic semester for the current calendar date."""

from datetime import date

from flask import Blueprint, jsonify

current_semester_bp = Blueprint("current_semester", __name__)


def semester_for_date(today=None):
    today = today or date.today()
    if 1 <= today.month <= 5:
        return f"Spring {today.year}"
    if 8 <= today.month <= 12:
        return f"Fall {today.year}"
    return None


@current_semester_bp.get("/api/current-semester")
def get_current_semester():
    semester = semester_for_date()
    if semester is None:
        return jsonify(error="Current date is outside the supported Spring and Fall semesters"), 422
    return jsonify(semester=semester)
