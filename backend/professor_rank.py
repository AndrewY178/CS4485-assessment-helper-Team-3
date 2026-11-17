"""AC update for professors.professor_rank."""

from flask import Blueprint, jsonify

from api_helpers import error, json_body
from auth import ac_required
from db import query

professor_rank_bp = Blueprint("professor_rank", __name__)


def _known_ranks():
    return {"Assistant", "Associate", "Full"}


@professor_rank_bp.put("/api/users/<int:professor_id>/rank")
@ac_required
def update_professor_rank(professor_id):
    rank = json_body().get("prof_rank")
    if not isinstance(rank, str) or not rank.strip():
        return error("prof_rank is required", 400)

    rank = rank.strip()
    if len(rank) > 50:
        return error("prof_rank must be 50 characters or fewer", 400)
    if rank not in _known_ranks():
        return error("prof_rank must be Assistant, Associate, or Full", 400)

    professors = query(
        "SELECT professor_id FROM professors WHERE professor_id = %s",
        (professor_id,),
    )
    if not professors:
        return error("Professor not found", 404)

    query(
        "UPDATE professors SET professor_rank = %s WHERE professor_id = %s",
        (rank, professor_id),
        fetch=False,
    )
    return jsonify(id=professor_id, prof_rank=rank)
