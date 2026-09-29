import random
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import DAILY_GOAL, NEW_PER_DAY, REVIEW_PER_DAY
from ..database import get_db
from ..models import BookWord, ReviewLog, Unit, UnitScope, User, UserWord, Word
from ..points import check_task, get_or_today_stat, task_states, touch_streak
from ..schemas import GradeIn
from ..serialize import me_dict, word_dict
from ..sm2 import apply_grade

router = APIRouter(prefix="/api/study", tags=["study"])


def _study_word_ids(db: Session, user: User):
    """学习开关打开的单元里的全部单词 id。"""
    return {
        r[0]
        for r in db.query(BookWord.word_id)
        .join(UnitScope, (UnitScope.unit_id == BookWord.unit_id) & (UnitScope.user_id == user.id))
        .filter(UnitScope.study.is_(True))
        .distinct()
    }


@router.get("/today")
def today(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stat = get_or_today_stat(db, user)
    enabled = _study_word_ids(db, user)

    items = []
    if enabled:
        reviews = (
            db.query(UserWord)
            .filter(
                UserWord.user_id == user.id,
                UserWord.learned.is_(True),
                UserWord.due_at <= date.today(),
                UserWord.word_id.in_(enabled),
            )
            .order_by(UserWord.due_at)
            .limit(REVIEW_PER_DAY)
            .all()
        )
        for uw in reviews:
            w = db.get(Word, uw.word_id)
            if w:
                items.append({"user_word_id": uw.id, "word": word_dict(w), "is_new": False})

        new_word_ids = {uw.word_id for uw in db.query(UserWord).filter(UserWord.user_id == user.id)}
        newq = (
            db.query(Word, Unit.order_no, BookWord.order_no)
            .join(BookWord, BookWord.word_id == Word.id)
            .join(Unit, Unit.id == BookWord.unit_id)
            .join(UnitScope, (UnitScope.unit_id == BookWord.unit_id) & (UnitScope.user_id == user.id))
            .filter(UnitScope.study.is_(True))
        )
        if new_word_ids:
            newq = newq.filter(~Word.id.in_(new_word_ids))
        news = (
            newq.order_by(Unit.order_no, BookWord.order_no)
            .distinct()
            .limit(NEW_PER_DAY)
            .all()
        )
        for w, _, _ in news:
            items.append({"user_word_id": None, "word": word_dict(w), "is_new": True})

    db.commit()
    me = me_dict(user, db)
    return {
        "items": items,
        "tasks": task_states(stat),
        "stats": {
            "learned_today": me["learned_today"],
            "goal": DAILY_GOAL,
            "streak": me["streak"],
            "remaining": len(items),
            "reviews_due": sum(1 for i in items if not i["is_new"]),
            "new_count": sum(1 for i in items if i["is_new"]),
        },
    }


@router.post("/grade")
def grade(body: GradeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.level not in ("yes", "fuzzy", "no"):
        raise HTTPException(status_code=400, detail="level 必须是 yes / fuzzy / no")
    word = db.get(Word, body.word_id)
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")

    uw = (
        db.query(UserWord)
        .filter(UserWord.user_id == user.id, UserWord.word_id == word.id)
        .first()
    )
    if uw is None:
        uw = UserWord(user_id=user.id, word_id=word.id)
        db.add(uw)
        db.flush()

    apply_grade(uw, body.level)

    stat = get_or_today_stat(db, user)
    stat.words_reviewed += 1
    touch_streak(db, user)
    db.add(ReviewLog(user_id=user.id, word_id=word.id, mode="card", correct=body.level == "yes"))

    # 过卡本身不加分，积分来自练习和任务
    task_gain = check_task(db, user, stat, "words")
    db.commit()

    return {
        "ok": True,
        "due_at": uw.due_at.isoformat(),
        "interval_days": uw.interval_days,
        "points_added": task_gain,
        "task_awarded": task_gain > 0,
        "total_points": user.points,
        "user": me_dict(user, db),
    }


@router.get("/tasks")
def tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stat = get_or_today_stat(db, user)
    db.commit()
    return task_states(stat)
