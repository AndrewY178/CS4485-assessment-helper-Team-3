"""Observer evaluation drafts, participant signatures, and observee review."""

from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from api_helpers import error, transaction
from auth import faculty_required
from deadlines import deadline_block

evaluations_bp = Blueprint("evaluations", __name__)

MEETING_SELECT = """
    SELECT m.meeting_id, m.meeting_date, m.observer_id,
           c.prof_id AS observee_id, c.semester, c.course_id,
           c.department, c.course_number, c.section_number, c.course_name,
           observer.professor_name AS observer_name,
           observee.professor_name AS observee_name,
           ec.signup_deadline
    FROM meetings m
    JOIN courses c ON c.course_id = m.course_id
    JOIN professors observee ON observee.professor_id = c.prof_id
    LEFT JOIN professors observer ON observer.professor_id = m.observer_id
    LEFT JOIN evaluation_cycles ec ON ec.semester = c.semester
    WHERE m.meeting_id = %s
      AND m.meeting_date IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM observation_requests confirmed_request
          WHERE confirmed_request.meeting_id = m.meeting_id
            AND confirmed_request.observer_id = m.observer_id
            AND confirmed_request.status = 'confirmed'
      )
"""


def _meeting(cursor, meeting_id):
    cursor.execute(MEETING_SELECT, (meeting_id,))
    return cursor.fetchone()


def _evaluation(cursor, evaluation_id):
    cursor.execute(
        """
        SELECT e.evaluation_id, e.meeting_id, e.version_id, e.evaluation_status,
               e.observer_signed_by, e.observer_signature_name, e.observer_signed_at,
               e.observee_signed_by, e.observee_signature_name, e.observee_signed_at,
               e.observee_response, e.created_at, e.updated_at, e.submitted_at,
               m.observer_id, c.prof_id AS observee_id, c.semester,
               c.department, c.course_number, c.section_number, c.course_name,
               m.meeting_date, observer.professor_name AS observer_name,
               observee.professor_name AS observee_name
        FROM evaluations e
        JOIN meetings m ON m.meeting_id = e.meeting_id
        JOIN courses c ON c.course_id = m.course_id
        JOIN professors observer ON observer.professor_id = m.observer_id
        JOIN professors observee ON observee.professor_id = c.prof_id
        WHERE e.evaluation_id = %s
        """,
        (evaluation_id,),
    )
    return cursor.fetchone()


def _serialize_dt(value):
    return value.isoformat() if value else None


def _evaluation_response(cursor, evaluation):
    cursor.execute(
        """
        SELECT q.question_id, q.question_key, q.question_name, q.question_description,
               q.question_type, q.question_weight, q.is_required, q.display_order,
               a.answer_number, a.answer_text
        FROM form_questions q
        LEFT JOIN evaluation_answers a
          ON a.version_id = q.version_id
         AND a.question_id = q.question_id
         AND a.evaluation_id = %s
        WHERE q.version_id = %s
        ORDER BY q.display_order, q.question_id
        """,
        (evaluation["evaluation_id"], evaluation["version_id"]),
    )
    questions = []
    answers = {}
    for row in cursor.fetchall():
        question_id = row["question_id"]
        value = row["answer_text"]
        if row["answer_number"] is not None:
            value = float(row["answer_number"])
        if value is not None:
            answers[str(question_id)] = value
        questions.append({
            "id": question_id,
            "key": row["question_key"],
            "name": row["question_name"],
            "description": row["question_description"] or "",
            "type": row["question_type"],
            "weight": float(row["question_weight"]) if row["question_weight"] is not None else None,
            "required": bool(row["is_required"]),
            "position": row["display_order"],
        })

    course_code = f'{evaluation["department"]} {evaluation["course_number"]}.{evaluation["section_number"]}'
    return {
        "id": evaluation["evaluation_id"],
        "meetingId": evaluation["meeting_id"],
        "semester": evaluation["semester"],
        "meetingDate": _serialize_dt(evaluation["meeting_date"]),
        "course": {"code": course_code, "title": evaluation["course_name"]},
        "observer": {"id": evaluation["observer_id"], "name": evaluation["observer_name"]},
        "observee": {"id": evaluation["observee_id"], "name": evaluation["observee_name"]},
        "versionId": evaluation["version_id"],
        "status": "complete" if evaluation["observee_signed_at"] else "awaiting_observee" if evaluation["observer_signed_at"] else "draft",
        "questions": questions,
        "answers": answers,
        "observerSignature": {
            "name": evaluation["observer_signature_name"],
            "signedAt": _serialize_dt(evaluation["observer_signed_at"]),
        },
        "observeeSignature": {
            "name": evaluation["observee_signature_name"],
            "signedAt": _serialize_dt(evaluation["observee_signed_at"]),
        },
        "observeeResponse": evaluation["observee_response"] or "",
        "updatedAt": _serialize_dt(evaluation["updated_at"]),
    }


def _name_matches(cursor, typed_name):
    if not isinstance(typed_name, str) or not typed_name.strip():
        return False, "Type your full name to sign this evaluation."
    cursor.execute("SELECT professor_name FROM professors WHERE professor_id = %s", (g.user_id,))
    row = cursor.fetchone()
    expected = " ".join((row["professor_name"] if row else "").split()).casefold()
    provided = " ".join(typed_name.split()).casefold()
    if not expected or expected != provided:
        return False, "The typed name must match the name on your account."
    return True, " ".join(typed_name.split())


def _validate_answers(cursor, version_id, answers, *, require_required=False):
    if not isinstance(answers, dict):
        return None, "answers must be an object keyed by question ID"
    cursor.execute(
        "SELECT question_id, question_type, is_required FROM form_questions WHERE version_id = %s",
        (version_id,),
    )
    questions = {str(row["question_id"]): row for row in cursor.fetchall()}
    normalized = []
    for question_id, value in answers.items():
        question = questions.get(str(question_id))
        if not question:
            return None, f"Question {question_id} does not belong to this evaluation"
        answer_number = None
        answer_text = None
        if question["question_type"] == "rating":
            if value == "N/A":
                answer_text = "N/A"
            else:
                try:
                    answer_number = Decimal(str(value))
                except (InvalidOperation, ValueError):
                    return None, f"Question {question_id} needs a rating from 1 to 5 or N/A"
                if (
                    not answer_number.is_finite()
                    or answer_number < 1
                    or answer_number > 5
                    or answer_number != answer_number.to_integral_value()
                ):
                    return None, f"Question {question_id} needs a rating from 1 to 5 or N/A"
        elif question["question_type"] == "yes_no":
            if value not in ("yes", "no"):
                return None, f"Question {question_id} needs a yes or no answer"
            answer_text = value
        elif isinstance(value, str):
            answer_text = value.strip()
        else:
            return None, f"Question {question_id} needs a text answer"
        if isinstance(answer_text, str) and len(answer_text) > 10000:
            return None, f"Answer for question {question_id} is too long"
        normalized.append((int(question_id), answer_number, answer_text))
    if require_required:
        provided = {str(question_id): (number, text) for question_id, number, text in normalized}
        for question_id, question in questions.items():
            if question["is_required"]:
                answer = provided.get(question_id)
                if answer is None or (answer[0] is None and not (answer[1] or "").strip()):
                    return None, f"Complete the required question {question_id} before signing"
    return normalized, None


def _participant(evaluation):
    if evaluation is None:
        return None
    if evaluation["observer_id"] == g.user_id:
        return "observer"
    if evaluation["observee_id"] == g.user_id:
        return "observee"
    return None


def _observation_is_confirmed(cursor, meeting_id, observer_id):
    cursor.execute(
        """
        SELECT 1 FROM observation_requests
        WHERE meeting_id = %s AND observer_id = %s AND status = 'confirmed'
        """,
        (meeting_id, observer_id),
    )
    return cursor.fetchone() is not None


@evaluations_bp.get("/api/evaluations/observer")
@faculty_required
def list_observer_evaluations():
    with transaction() as cursor:
        cursor.execute(
            """
            SELECT m.meeting_id, m.meeting_date, c.semester, c.department,
                   c.course_number, c.section_number, c.course_name,
                   observee.professor_name AS observee_name, ec.signup_deadline,
                   e.evaluation_id, e.observer_signed_at, e.observee_signed_at
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            JOIN professors observee ON observee.professor_id = c.prof_id
            JOIN observation_requests r ON r.meeting_id = m.meeting_id
                AND r.observer_id = m.observer_id AND r.status = 'confirmed'
            LEFT JOIN evaluation_cycles ec ON ec.semester = c.semester
            LEFT JOIN evaluations e ON e.meeting_id = m.meeting_id
            WHERE m.observer_id = %s AND m.meeting_date IS NOT NULL
            ORDER BY m.meeting_date DESC, m.meeting_id DESC
            """,
            (g.user_id,),
        )
        rows = cursor.fetchall()
        result = []
        now = datetime.utcnow()
        for row in rows:
            deadline_passed = row["signup_deadline"] is not None and row["signup_deadline"] <= now
            result.append({
                "meetingId": row["meeting_id"],
                "evaluationId": row["evaluation_id"],
                "semester": row["semester"],
                "meetingDate": _serialize_dt(row["meeting_date"]),
                "course": {
                    "code": f'{row["department"]} {row["course_number"]}.{row["section_number"]}',
                    "title": row["course_name"],
                },
                "observeeName": row["observee_name"],
                "status": "complete" if row["observee_signed_at"] else "awaiting_observee" if row["observer_signed_at"] else "draft" if row["evaluation_id"] else "not_started",
                "canStart": bool(deadline_passed and not row["evaluation_id"]),
                "deadlinePassed": bool(deadline_passed),
            })
    return jsonify(observations=result)


@evaluations_bp.get("/api/evaluations/observee")
@faculty_required
def list_observee_evaluations():
    with transaction() as cursor:
        cursor.execute(
            """
            SELECT m.meeting_id, e.evaluation_id, e.version_id,
                   e.observer_signed_at, e.observee_signed_at,
                   c.semester, c.department, c.course_number, c.section_number, c.course_name,
                   m.meeting_date, m.observer_id,
                   observer.professor_name AS observer_name,
                   observee.professor_name AS observee_name,
                   r.status AS request_status
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            JOIN professors observee ON observee.professor_id = c.prof_id
            LEFT JOIN observation_requests r ON r.meeting_id = m.meeting_id
                AND r.observer_id = m.observer_id
            LEFT JOIN professors observer ON observer.professor_id = m.observer_id
            LEFT JOIN evaluations e ON e.meeting_id = m.meeting_id
            WHERE c.prof_id = %s
              AND (
                (r.status = 'confirmed' AND (e.evaluation_id IS NULL OR e.observer_signed_at IS NULL))
                OR r.status = 'canceled'
                OR e.observer_signed_at IS NOT NULL
              )
            ORDER BY m.meeting_date DESC, m.meeting_id DESC
            """,
            (g.user_id,),
        )
        rows = cursor.fetchall()
        evaluations = []
        for row in rows:
            if row["observer_signed_at"]:
                evaluation = _evaluation(cursor, row["evaluation_id"])
                evaluations.append(_evaluation_response(cursor, evaluation))
                continue

            canceled = row["request_status"] == "canceled"
            version_id = row["version_id"]
            if not version_id and not canceled:
                cursor.execute(
                    """
                    SELECT version_id FROM evaluation_form_versions
                    WHERE effective_semester = %s
                    ORDER BY version_number DESC LIMIT 1
                    """,
                    (row["semester"],),
                )
                version = cursor.fetchone()
                version_id = version["version_id"] if version else None
            questions = []
            if version_id and not canceled:
                cursor.execute(
                    """
                    SELECT question_id, question_key, question_name, question_description,
                           question_type, question_weight, is_required, display_order
                    FROM form_questions WHERE version_id = %s
                    ORDER BY display_order, question_id
                    """,
                    (version_id,),
                )
                questions = [{
                    "id": q["question_id"], "key": q["question_key"],
                    "name": q["question_name"], "description": q["question_description"] or "",
                    "type": q["question_type"],
                    "weight": float(q["question_weight"]) if q["question_weight"] is not None else None,
                    "required": bool(q["is_required"]), "position": q["display_order"],
                } for q in cursor.fetchall()]
            evaluations.append({
                "id": -row["meeting_id"], "meetingId": row["meeting_id"],
                "semester": row["semester"], "meetingDate": _serialize_dt(row["meeting_date"]),
                "course": {"code": f'{row["department"]} {row["course_number"]}.{row["section_number"]}', "title": row["course_name"]},
                "observer": {"id": row["observer_id"], "name": row["observer_name"]},
                "observee": {"id": g.user_id, "name": row["observee_name"]},
                "versionId": version_id, "status": "canceled" if canceled else "upcoming", "questions": questions,
                "answers": {}, "observerSignature": {"name": None, "signedAt": None},
                "observeeSignature": {"name": None, "signedAt": None},
                "observeeResponse": "", "updatedAt": None,
            })
    return jsonify(evaluations=evaluations)


@evaluations_bp.post("/api/meetings/<int:meeting_id>/cancel")
@faculty_required
def cancel_observation(meeting_id):
    with transaction() as cursor:
        cursor.execute(
            "SELECT meeting_id FROM meetings WHERE meeting_id = %s FOR UPDATE",
            (meeting_id,),
        )
        if not cursor.fetchone():
            return error("Observation was not found", 404)
        cursor.execute(
            """
            SELECT c.prof_id AS observee_id, r.status
            FROM meetings m
            JOIN courses c ON c.course_id = m.course_id
            JOIN observation_requests r ON r.meeting_id = m.meeting_id
                AND r.observer_id = m.observer_id
            WHERE m.meeting_id = %s
            """,
            (meeting_id,),
        )
        row = cursor.fetchone()
        if not row or row["observee_id"] != g.user_id:
            return error("Observation was not found", 404)
        if row["status"] != "confirmed":
            return error("This observation is no longer active", 409)
        cursor.execute(
            "SELECT observer_signed_at FROM evaluations WHERE meeting_id = %s FOR UPDATE",
            (meeting_id,),
        )
        evaluation = cursor.fetchone()
        if evaluation and evaluation["observer_signed_at"]:
            return error("The observer has already signed this observation", 409)
        cursor.execute(
            "UPDATE observation_requests SET status = 'canceled' WHERE meeting_id = %s AND status = 'confirmed'",
            (meeting_id,),
        )
        if cursor.rowcount != 1:
            return error("This observation is no longer active", 409)
    return jsonify(meetingId=meeting_id, status="canceled")


@evaluations_bp.post("/api/meetings/<int:meeting_id>/evaluation")
@faculty_required
def start_evaluation(meeting_id):
    with transaction() as cursor:
        cursor.execute("SELECT meeting_id FROM meetings WHERE meeting_id = %s FOR UPDATE", (meeting_id,))
        if not cursor.fetchone():
            return error("Confirmed meeting was not found", 404)
        meeting = _meeting(cursor, meeting_id)
        if not meeting:
            return error("Confirmed meeting was not found", 404)
        if meeting["observer_id"] != g.user_id:
            return error("Only the assigned observer can start this evaluation", 403)
        if not meeting["signup_deadline"] or meeting["signup_deadline"] > datetime.utcnow():
            return error("The evaluation form becomes available after the signup deadline", 409)
        cursor.execute("SELECT evaluation_id FROM evaluations WHERE meeting_id = %s FOR UPDATE", (meeting_id,))
        existing = cursor.fetchone()
        if existing:
            evaluation = _evaluation(cursor, existing["evaluation_id"])
            return jsonify(evaluation=_evaluation_response(cursor, evaluation))
        cursor.execute(
            """
            SELECT version_id FROM evaluation_form_versions
            WHERE effective_semester = %s
            ORDER BY version_number DESC LIMIT 1
            """,
            (meeting["semester"],),
        )
        version = cursor.fetchone()
        if not version:
            return error("No evaluation template is available for this semester", 409)
        cursor.execute(
            "INSERT INTO evaluations (meeting_id, version_id) VALUES (%s, %s)",
            (meeting_id, version["version_id"]),
        )
        evaluation_id = cursor.lastrowid
        evaluation = _evaluation(cursor, evaluation_id)
        return jsonify(evaluation=_evaluation_response(cursor, evaluation)), 201


@evaluations_bp.get("/api/evaluations/<int:evaluation_id>")
@faculty_required
def get_evaluation(evaluation_id):
    with transaction() as cursor:
        evaluation = _evaluation(cursor, evaluation_id)
        role = _participant(evaluation)
        if not role:
            return error("Evaluation was not found", 404)
        if role == "observer":
            if not _observation_is_confirmed(cursor, evaluation["meeting_id"], g.user_id):
                return error("Evaluation was not found", 404)
            cursor.execute("SELECT signup_deadline FROM evaluation_cycles WHERE semester = %s", (evaluation["semester"],))
            cycle = cursor.fetchone()
            if not cycle or cycle["signup_deadline"] > datetime.utcnow():
                return error("The evaluation form becomes available after the signup deadline", 409)
        elif not evaluation["observer_signed_at"]:
            return error("The observer has not signed this evaluation yet", 409)
        data = _evaluation_response(cursor, evaluation)
    return jsonify(evaluation=data)


@evaluations_bp.put("/api/evaluations/<int:evaluation_id>")
@faculty_required
def save_observer_answers(evaluation_id):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return error("A JSON object is required", 400)
    with transaction() as cursor:
        cursor.execute("SELECT evaluation_id FROM evaluations WHERE evaluation_id = %s FOR UPDATE", (evaluation_id,))
        cursor.fetchone()
        evaluation = _evaluation(cursor, evaluation_id)
        if not evaluation or evaluation["observer_id"] != g.user_id:
            return error("Evaluation was not found", 404)
        if not _observation_is_confirmed(cursor, evaluation["meeting_id"], g.user_id):
            return error("Evaluation was not found", 404)
        blocked = deadline_block("complete_evaluation", evaluation["semester"])
        if blocked:
            return blocked
        if evaluation["observer_signed_at"]:
            return error("Observer-signed answers cannot be edited", 409)
        cursor.execute("SELECT signup_deadline FROM evaluation_cycles WHERE semester = %s", (evaluation["semester"],))
        cycle = cursor.fetchone()
        if not cycle or cycle["signup_deadline"] > datetime.utcnow():
            return error("The evaluation form becomes available after the signup deadline", 409)
        answers, validation_error = _validate_answers(cursor, evaluation["version_id"], body.get("answers"))
        if validation_error:
            return error(validation_error, 400)
        cursor.execute("DELETE FROM evaluation_answers WHERE evaluation_id = %s", (evaluation_id,))
        cursor.executemany(
            """
            INSERT INTO evaluation_answers (evaluation_id, version_id, question_id, answer_number, answer_text)
            VALUES (%s, %s, %s, %s, %s)
            """,
            [(evaluation_id, evaluation["version_id"], question_id, number, text) for question_id, number, text in answers],
        )
        updated = _evaluation(cursor, evaluation_id)
        data = _evaluation_response(cursor, updated)
    return jsonify(evaluation=data)


@evaluations_bp.post("/api/evaluations/<int:evaluation_id>/observer-signature")
@faculty_required
def sign_as_observer(evaluation_id):
    body = request.get_json(silent=True) or {}
    with transaction() as cursor:
        cursor.execute("SELECT evaluation_id FROM evaluations WHERE evaluation_id = %s FOR UPDATE", (evaluation_id,))
        cursor.fetchone()
        evaluation = _evaluation(cursor, evaluation_id)
        if not evaluation or evaluation["observer_id"] != g.user_id:
            return error("Evaluation was not found", 404)
        if not _observation_is_confirmed(cursor, evaluation["meeting_id"], g.user_id):
            return error("Evaluation was not found", 404)
        blocked = deadline_block("complete_evaluation", evaluation["semester"])
        if blocked:
            return blocked
        if evaluation["observer_signed_at"]:
            return error("This evaluation has already been signed by the observer", 409)
        cursor.execute("SELECT signup_deadline FROM evaluation_cycles WHERE semester = %s", (evaluation["semester"],))
        cycle = cursor.fetchone()
        if not cycle or cycle["signup_deadline"] > datetime.utcnow():
            return error("The evaluation form becomes available after the signup deadline", 409)
        valid_name, result = _name_matches(cursor, body.get("typedName"))
        if not valid_name:
            return error(result, 400)
        answers, validation_error = _validate_answers(cursor, evaluation["version_id"], body.get("answers", {}), require_required=True)
        if validation_error:
            return error(validation_error, 400)
        cursor.execute("DELETE FROM evaluation_answers WHERE evaluation_id = %s", (evaluation_id,))
        cursor.executemany(
            """
            INSERT INTO evaluation_answers (evaluation_id, version_id, question_id, answer_number, answer_text)
            VALUES (%s, %s, %s, %s, %s)
            """,
            [(evaluation_id, evaluation["version_id"], question_id, number, text) for question_id, number, text in answers],
        )
        cursor.execute(
            """
            UPDATE evaluations SET observer_signed_by = %s,
                observer_signature_name = %s, observer_signed_at = UTC_TIMESTAMP()
            WHERE evaluation_id = %s
            """,
            (g.user_id, result, evaluation_id),
        )
        signed = _evaluation(cursor, evaluation_id)
        data = _evaluation_response(cursor, signed)
    return jsonify(evaluation=data)


@evaluations_bp.put("/api/evaluations/<int:evaluation_id>/observee-response")
@faculty_required
def save_observee_response(evaluation_id):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get("response", ""), str):
        return error("response must be a string", 400)
    response = body.get("response", "").strip()
    if len(response) > 10000:
        return error("Response must be 10,000 characters or fewer", 400)
    with transaction() as cursor:
        cursor.execute("SELECT evaluation_id FROM evaluations WHERE evaluation_id = %s FOR UPDATE", (evaluation_id,))
        cursor.fetchone()
        evaluation = _evaluation(cursor, evaluation_id)
        if not evaluation or evaluation["observee_id"] != g.user_id:
            return error("Evaluation was not found", 404)
        blocked = deadline_block("complete_evaluation", evaluation["semester"])
        if blocked:
            return blocked
        if not evaluation["observer_signed_at"]:
            return error("The observer must sign before you can respond", 409)
        if evaluation["observee_signed_at"]:
            return error("This evaluation is fully signed and read-only", 409)
        cursor.execute("UPDATE evaluations SET observee_response = %s WHERE evaluation_id = %s", (response, evaluation_id))
        updated = _evaluation(cursor, evaluation_id)
        data = _evaluation_response(cursor, updated)
    return jsonify(evaluation=data)


@evaluations_bp.post("/api/evaluations/<int:evaluation_id>/observee-signature")
@faculty_required
def sign_as_observee(evaluation_id):
    body = request.get_json(silent=True) or {}
    response = body.get("response", "")
    if not isinstance(response, str) or len(response) > 10000:
        return error("response must be a string of 10,000 characters or fewer", 400)
    with transaction() as cursor:
        cursor.execute("SELECT evaluation_id FROM evaluations WHERE evaluation_id = %s FOR UPDATE", (evaluation_id,))
        cursor.fetchone()
        evaluation = _evaluation(cursor, evaluation_id)
        if not evaluation or evaluation["observee_id"] != g.user_id:
            return error("Evaluation was not found", 404)
        blocked = deadline_block("complete_evaluation", evaluation["semester"])
        if blocked:
            return blocked
        if not evaluation["observer_signed_at"]:
            return error("The observer must sign before you can sign", 409)
        if evaluation["observee_signed_at"]:
            return error("This evaluation has already been signed by the observee", 409)
        valid_name, result = _name_matches(cursor, body.get("typedName"))
        if not valid_name:
            return error(result, 400)
        cursor.execute(
            """
            UPDATE evaluations SET observee_response = %s, observee_signed_by = %s,
                observee_signature_name = %s, observee_signed_at = UTC_TIMESTAMP(),
                evaluation_status = 'submitted', submitted_at = UTC_TIMESTAMP()
            WHERE evaluation_id = %s
            """,
            (response.strip(), g.user_id, result, evaluation_id),
        )
        signed = _evaluation(cursor, evaluation_id)
        data = _evaluation_response(cursor, signed)
    return jsonify(evaluation=data)
