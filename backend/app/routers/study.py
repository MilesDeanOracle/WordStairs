import random
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import DAILY_GOAL, NEW_PER_DAY, REVIEW_PER_DAY
from ..database import get_db
from ..models import BookWord, ReviewLog, Unit, UnitScope, User, UserWord, Word
from ..points import get_or_today_stat, task_states, touch_streak
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

    # 今天过过的全部词（含已出列的）：队列是滚动窗口，前端「重新学习」
    # 需要靠这份快照把今天学过的词从第一张再排一遍。
    # ReviewLog.created_at 是 naive UTC，这里的起点是「本地今天零点」换算成的 UTC。
    day_start_utc = (
        datetime.combine(date.today(), time.min)
        .astimezone()
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    day_items: list[dict] = []
    seen_day: set[int] = set()
    day_logs = (
        db.query(ReviewLog)
        .filter(
            ReviewLog.user_id == user.id,
            ReviewLog.mode == "card",
            ReviewLog.created_at >= day_start_utc,
        )
        .order_by(ReviewLog.id)
        .all()
    )
    for log in day_logs:
        if log.word_id in seen_day:
            continue
        seen_day.add(log.word_id)
        w = db.get(Word, log.word_id)
        if not w:
            continue
        uw = (
            db.query(UserWord)
            .filter(UserWord.user_id == user.id, UserWord.word_id == w.id)
            .first()
        )
        day_items.append({"user_word_id": uw.id if uw else None, "word": word_dict(w), "is_new": False})

    return {
        "items": items,
        "day_items": day_items,
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
    stat.words_reviewed += 1  # 仅用于「今日已学 x/goal」展示，不参与任何加分
    touch_streak(db, user)
    db.add(ReviewLog(user_id=user.id, word_id=word.id, mode="card", correct=body.level == "yes"))

    # 今日学习（过卡/复习）一律不加分，积分只在专项练习答对时发放
    db.commit()

    return {
        "ok": True,
        "due_at": uw.due_at.isoformat(),
        "interval_days": uw.interval_days,
        "points_added": 0,
        "task_awarded": False,
        "total_points": user.points,
        "user": me_dict(user, db),
    }


@router.get("/tasks")
def tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stat = get_or_today_stat(db, user)
    db.commit()
    return task_states(stat)
