"""Determine the current and next academic semesters."""

from datetime import date

from flask import Blueprint, jsonify

current_semester_bp = Blueprint("current_semester", __name__)


def semester_for_date(today=None):
    """Return the current setup semester, treating summer as the upcoming Fall."""
    today = today or date.today()
    if 1 <= today.month <= 5:
        return f"Spring {today.year}"
    return f"Fall {today.year}"


def next_semester(semester):
    season, year_text = semester.split()
    year = int(year_text)
    if season == "Spring":
        return f"Fall {year}"
    return f"Spring {year + 1}"


@current_semester_bp.get("/api/current-semester")
def get_current_semester():
    semester = semester_for_date()
    return jsonify(semester=semester, nextSemester=next_semester(semester))
