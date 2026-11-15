"""AC-managed, semester-scoped evaluation form versions."""

import re
from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from api_helpers import error, transaction
from auth import ac_required

templates_bp = Blueprint("templates", __name__)

QUESTION_TYPES = {
    "Rating 1–5": "rating",
    "Yes/No": "yes_no",
    "Short Answer": "short_answer",
    "Long Answer": "long_answer",
}
QUESTION_LABELS = {value: key for key, value in QUESTION_TYPES.items()}
SEMESTER_RE = re.compile(r"^(Spring|Summer|Fall) (\d{4})$")
TERM_ORDER = {"Spring": 0, "Summer": 1, "Fall": 2}


def _semester_key(semester):
    match = SEMESTER_RE.fullmatch(semester or "")
    return (int(match.group(2)), TERM_ORDER[match.group(1)]) if match else (-1, -1)


# determines the semester currently happening and the next semester
def _effective_semesters(cycles, now):
    ordered = sorted(cycles, key=lambda cycle: _semester_key(cycle["semester"]))
    open_cycles = [cycle for cycle in ordered if cycle["signup_deadline"] >= now]
    current = open_cycles[-1] if open_cycles else (ordered[-1] if ordered else None)
    current_index = ordered.index(current) if current else -1
    next_cycle = ordered[current_index + 1] if current_index >= 0 and current_index + 1 < len(ordered) else None
    return current, next_cycle

# get the latest version of the template
def _latest_version(cursor, semester=None):
    sql = """
        SELECT version_id, version_number, version_status, effective_semester, created_at
        FROM evaluation_form_versions
        WHERE 1 = 1
    """
    params = []
    if semester is not None:
        sql += " AND effective_semester = %s"
        params.append(semester)
    sql += " ORDER BY version_number DESC LIMIT 1"
    cursor.execute(sql, tuple(params))
    return cursor.fetchone()


# get a question
def _criteria(cursor, version_id):
    cursor.execute(
        """
        SELECT question_id, question_key, question_name, question_description,
               question_type, question_weight, is_required, display_order
        FROM form_questions WHERE version_id = %s ORDER BY display_order, question_id
        """,
        (version_id,),
    )
    return [
        {
            "id": str(row["question_id"]),
            "key": row["question_key"],
            "name": row["question_name"],
            "description": row["question_description"] or "",
            "type": QUESTION_LABELS[row["question_type"]],
            "weight": float(row["question_weight"]) if row["question_weight"] is not None else None,
            "required": bool(row["is_required"]),
            "position": index,
        }
        for index, row in enumerate(cursor.fetchall(), start=1)
    ]

# get a full response for a particular version of the template
def _version_response(cursor, semester, version, *, is_editable):
    if version:
        criteria = _criteria(cursor, version["version_id"])
        return {
            "id": str(version["version_id"]),
            "version": version["version_number"],
            "status": "current" if version["version_status"] == "published" else "draft",
            "effectiveSemester": semester,
            "criteria": criteria,
            "isEditable": is_editable,
            "isInheritedDraft": False,
        }
    latest = _latest_version(cursor)
    criteria = _criteria(cursor, latest["version_id"]) if latest else []
    return {
        "id": f"draft-{semester}",
        "version": None,
        "status": "draft",
        "effectiveSemester": semester,
        "criteria": criteria,
        "isEditable": is_editable,
        "isInheritedDraft": bool(latest),
    }


def _page_data(cursor, selected_semester=None):
    cursor.execute("SELECT semester, signup_deadline FROM evaluation_cycles")
    cycles = cursor.fetchall()
    from datetime import datetime
    now = datetime.utcnow()
    current, next_cycle = _effective_semesters(cycles, now)
    versions_by_semester = {}
    cursor.execute(
        """
        SELECT v.effective_semester, v.version_id, v.version_number,
               v.version_status, v.created_at
        FROM evaluation_form_versions v
        JOIN (
            SELECT effective_semester, MAX(version_number) AS version_number
            FROM evaluation_form_versions
            WHERE effective_semester IS NOT NULL
            GROUP BY effective_semester
        ) latest ON latest.effective_semester = v.effective_semester
                AND latest.version_number = v.version_number
        """
    )
    versions_by_semester = {row["effective_semester"]: row for row in cursor.fetchall()}

    semester_names = {cycle["semester"] for cycle in cycles}
    semester_names.update(versions_by_semester)
    ordered_semesters = sorted(semester_names, key=_semester_key)
    editable = {cycle["semester"] for cycle in (current, next_cycle) if cycle}
    result = []
    for semester in ordered_semesters:
        cycle = next((item for item in cycles if item["semester"] == semester), None)
        is_editable = semester in editable and (
            semester != (current["semester"] if current else None)
            or (cycle and cycle["signup_deadline"] > now)
        )
        latest = versions_by_semester.get(semester)
        result.append({
            "semester": semester,
            "version": latest["version_number"] if latest else None,
            "status": latest["version_status"] if latest else "draft",
            "isEditable": bool(is_editable),
        })
    if selected_semester is not None:
        if selected_semester not in semester_names:
            return result, None, None
        cycle = next((item for item in cycles if item["semester"] == selected_semester), None)
        can_edit = selected_semester in editable and (
            selected_semester != (current["semester"] if current else None)
            or (cycle and cycle["signup_deadline"] > now)
        )
        version = versions_by_semester.get(selected_semester)
        data = _version_response(cursor, selected_semester, version, is_editable=bool(can_edit))
        data["signupDeadline"] = cycle["signup_deadline"].isoformat() if cycle else None
        return result, data, bool(can_edit)
    return result, None, None

# get the status for multiple semesters
@templates_bp.get("/api/templates")
@ac_required
def get_templates():
    with transaction() as cursor:
        semesters, _, _ = _page_data(cursor)
    return jsonify(semesters=semesters)


# get template for specific semester
@templates_bp.get("/api/templates/<semester>")
@ac_required
def get_template(semester):
    with transaction() as cursor:
        semesters, template, _ = _page_data(cursor, semester)
    if template is None:
        return error("No evaluation cycle or template exists for this semester", 404)
    return jsonify(template=template, semesters=semesters)


# update/create template for a spcefic semester
@templates_bp.put("/api/templates/<semester>")
@ac_required
def save_template(semester):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get("criteria"), list):
        return error("A JSON object with a criteria list is required", 400)
    criteria = body["criteria"]
    if not criteria:
        return error("At least one criterion is required", 400)
    seen_names = set()
    normalized = []
    # lots of checks for everything
    for criterion in criteria:
        if not isinstance(criterion, dict):
            return error("Each criterion must be an object", 400)
        name = criterion.get("name")
        description = criterion.get("description", "")
        question_type = criterion.get("type")
        required = criterion.get("required")
        weight = criterion.get("weight")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 255:
            return error("Each criterion needs a name of at most 255 characters", 400)
        normalized_name = name.strip()
        if normalized_name.casefold() in seen_names:
            return error("Criterion names must be unique", 400)
        seen_names.add(normalized_name.casefold())
        if not isinstance(description, str) or question_type not in QUESTION_TYPES or not isinstance(required, bool):
            return error("Criterion description, type, or required value is invalid", 400)
        if weight is not None:
            try:
                parsed_weight = Decimal(str(weight))
                if not parsed_weight.is_finite() or parsed_weight < 0 or parsed_weight > Decimal("9999.99"):
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                return error("Criterion weight must be a non-negative number", 400)
        else:
            parsed_weight = None
        if question_type == "Rating 1–5" and (parsed_weight is None or parsed_weight <= 0):
            return error("Rating criteria need a weight greater than zero", 400)
        if question_type != "Rating 1–5":
            parsed_weight = None
        normalized.append((normalized_name, description.strip(), QUESTION_TYPES[question_type], parsed_weight, required))

    with transaction() as cursor:
        semesters, _, can_edit = _page_data(cursor, semester)
        if semester not in {item["semester"] for item in semesters}:
            return error("No evaluation cycle or template exists for this semester", 404)
        if not can_edit:
            return error("This semester's template is read-only", 409)
        cursor.execute("SELECT GET_LOCK('evaluation_template_version_number', 10) AS acquired")
        if cursor.fetchone()["acquired"] != 1:
            return error("Template versioning is busy; try saving again", 503)
        try:
            cursor.execute(
                "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM evaluation_form_versions"
            )
            next_version = cursor.fetchone()["next_version"]
            cursor.execute(
                """
                INSERT INTO evaluation_form_versions
                    (version_number, version_status, effective_semester, created_by)
                VALUES (%s, 'draft', %s, %s)
                """,
                (next_version, semester, g.user_id),
            )
            version_id = cursor.lastrowid
            for index, (name, description, question_type, weight, required) in enumerate(normalized, start=1):
                # generate standardized key for database purposes
                key = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:90] or f"question-{index}"
                key = f"{key}-{index}"
                cursor.execute(
                    """
                    INSERT INTO form_questions
                        (version_id, question_key, question_name, question_description,
                         question_type, question_weight, is_required, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (version_id, key, name, description, question_type, weight, required, index),
                )
            cursor.execute(
                """
                SELECT version_id, version_number, version_status, effective_semester, created_at
                FROM evaluation_form_versions WHERE version_id = %s
                """,
                (version_id,),
            )
            version = cursor.fetchone()
            response = _version_response(cursor, semester, version, is_editable=True)
        finally:
            cursor.execute("SELECT RELEASE_LOCK('evaluation_template_version_number')")
    return jsonify(template=response), 201
