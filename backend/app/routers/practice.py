import random
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import BookWord, ReviewLog, UnitScope, User, Word
from ..points import add_points, check_task, get_or_today_stat, touch_streak
from ..schemas import AnswerIn
from ..serialize import me_dict

router = APIRouter(prefix="/api/practice", tags=["practice"])


def _base_words(db: Session, user: User, limit: int, need_example: bool = False):
    q = (
        db.query(Word)
        .join(BookWord, BookWord.word_id == Word.id)
        .join(UnitScope, (UnitScope.unit_id == BookWord.unit_id) & (UnitScope.user_id == user.id))
        .filter(UnitScope.practice.is_(True))
        .distinct()
    )
    # 释义为空或占位的词还没法出题，先跳过
    q = q.filter(Word.meaning != "", Word.meaning != "（待补）")
    if need_example:
        q = q.filter(Word.example != "")
    return q.order_by(func.random()).limit(limit).all()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower()).replace(" .", ".")


@router.get("/session")
def session(mode: str = "listen", limit: int = 5, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    limit = max(1, min(limit, 10))
    items = []

    if mode == "listen":
        words = _base_words(db, user, limit)
        all_meanings = [
            m
            for (m,) in db.query(Word.meaning).limit(200).all()
            if m and m != "（待补）"
        ]
        for w in words:
            distract = [m for m in dict.fromkeys(all_meanings) if m != w.meaning]
            options = [w.meaning] + random.sample(distract, min(3, len(distract)))
            random.shuffle(options)
            items.append(
                {
                    "word_id": w.id,
                    "text": w.text,
                    "options": options,
                    "correct_index": options.index(w.meaning),
                }
            )

    elif mode == "spell":
        words = _base_words(db, user, limit)
        items = [
            {"word_id": w.id, "meaning": w.meaning, "phonetic": w.phonetic, "length": len(w.text)}
            for w in words
        ]

    elif mode == "scramble":
        words = _base_words(db, user, limit, need_example=True)
        for w in words:
            chips = w.example.split(" ")
            random.shuffle(chips)
            items.append({"word_id": w.id, "sentence": w.example, "sentence_cn": w.example_cn, "chips": chips})

    elif mode == "speak":
        words = _base_words(db, user, limit, need_example=True)
        items = [{"word_id": w.id, "sentence": w.example, "sentence_cn": w.example_cn} for w in words]

    else:
        raise HTTPException(status_code=400, detail="mode 必须是 listen / spell / scramble / speak")

    if not items:
        raise HTTPException(status_code=404, detail="练习范围里还没有可出题的词，点顶栏的书签丝带设置一下学习范围")
    db.commit()
    return {"mode": mode, "items": items}


@router.post("/answer")
def answer(body: AnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    word = db.get(Word, body.word_id)
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")

    stat = get_or_today_stat(db, user)
    touch_streak(db, user)
    task_gain = 0
    gain = 0
    correct = False
    correct_answer = ""

    if body.mode == "listen":
        correct = body.answer.strip() == word.meaning
        correct_answer = word.meaning
        if correct:
            # 刮开提示后答对的只加 1 分，裸答加 2 分
            gain = add_points(db, user, 1 if body.hint_used else 2, f"听力 · {word.text}", stat)

    elif body.mode == "spell":
        correct = body.answer.strip().lower() == word.text.lower()
        correct_answer = word.text
        # 任务（及其奖励分）只在答对时计数
        if correct:
            stat.spell_done += 1
            task_gain += check_task(db, user, stat, "spell")
            gain = add_points(db, user, 2, f"拼写 · {word.text}", stat)

    elif body.mode == "scramble":
        correct = _norm(body.answer) == _norm(word.example)
        correct_answer = word.example
        if correct:
            gain = add_points(db, user, 2, f"句子重组 · {word.text}", stat)

    elif body.mode == "speak":
        score = body.score if body.score is not None else 0
        correct = score >= 50
        correct_answer = word.example
        if score >= 50:
            stat.speak_done += 1
            task_gain += check_task(db, user, stat, "speak")
            pts = 12 if score >= 90 else 8 if score >= 75 else 4
            gain = add_points(db, user, pts, f"跟读 · {word.text}", stat)

    else:
        raise HTTPException(status_code=400, detail="mode 不合法")

    db.add(ReviewLog(user_id=user.id, word_id=word.id, mode=body.mode, correct=correct))
    db.commit()

    return {
        "correct": correct,
        "correct_answer": correct_answer,
        "points_added": gain + task_gain,
        "task_awarded": task_gain > 0,
        "total_points": user.points,
        "user": me_dict(user, db),
    }
