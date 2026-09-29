from .config import DAILY_CAP, DAILY_GOAL
from .models import User, Word
from .points import get_or_today_stat, stage_of, stage_title


def word_dict(w: Word) -> dict:
    return {
        "id": w.id,
        "text": w.text,
        "phonetic": w.phonetic,
        "pos": w.pos,
        "meaning": w.meaning,
        "example": w.example,
        "example_cn": w.example_cn,
        "tip": w.tip,
    }


def me_dict(user: User, db) -> dict:
    stat = get_or_today_stat(db, user)
    stage = stage_of(user.points)
    return {
        "id": user.id,
        "username": user.username,
        "grade": user.grade,
        "points": user.points,
        "streak": user.streak,
        "is_admin": user.is_admin,
        "stage": stage,
        "stage_title": stage_title(stage),
        "next_stage_at": stage * 200,
        "daily_earned": stat.points_earned,
        "daily_cap": DAILY_CAP,
        "goal": DAILY_GOAL,
        "learned_today": stat.words_reviewed,
    }
