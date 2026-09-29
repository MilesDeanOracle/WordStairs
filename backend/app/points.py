"""积分引擎：所有加减分都在这里落账，前端只做展示。"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .config import DAILY_CAP
from .models import DailyStat, PointsLedger, User

STAGE_SIZE = 200  # 每阶 200 分


def stage_of(points: int) -> int:
    return min(50, points // STAGE_SIZE + 1)


def stage_title(stage: int) -> str:
    if stage <= 3:
        return "拾词生"
    if stage <= 9:
        return "词客"
    if stage <= 19:
        return "词士"
    if stage <= 34:
        return "词师"
    return "词宗"


def get_or_today_stat(db: Session, user: User) -> DailyStat:
    today = date.today()
    stat = (
        db.query(DailyStat)
        .filter(DailyStat.user_id == user.id, DailyStat.date == today)
        .first()
    )
    if stat is None:
        stat = DailyStat(user_id=user.id, date=today)
        db.add(stat)
        db.flush()
    return stat


def add_points(db: Session, user: User, delta: int, reason: str, stat: DailyStat | None = None) -> int:
    """返回实际落账的分值（可能被每日上限截断）。"""
    if delta == 0:
        return 0
    if delta > 0:
        stat = stat or get_or_today_stat(db, user)
        remaining = DAILY_CAP - stat.points_earned
        if remaining <= 0:
            return 0
        delta = min(delta, remaining)
        stat.points_earned += delta
    user.points += delta
    db.add(PointsLedger(user_id=user.id, delta=delta, reason=reason))
    return delta


def touch_streak(db: Session, user: User) -> None:
    today = date.today()
    if user.last_study_date == today:
        return
    yesterday = today - timedelta(days=1)
    user.streak = user.streak + 1 if user.last_study_date == yesterday else 1
    user.last_study_date = today


TASK_DEFS = [
    {"key": "words", "name": "复习 20 个单词", "pts": 15, "goal": 20},
    {"key": "spell", "name": "完成一次拼写练习", "pts": 20, "goal": 1},
    {"key": "speak", "name": "跟读 3 个句子", "pts": 10, "goal": 3},
]


_TASK_COL = {"words": "words_reviewed", "spell": "spell_done", "speak": "speak_done"}


def task_states(stat: DailyStat) -> list[dict]:
    rows = []
    for d in TASK_DEFS:
        now = getattr(stat, _TASK_COL[d["key"]])
        rows.append(
            {
                "key": d["key"],
                "name": d["name"],
                "pts": d["pts"],
                "goal": d["goal"],
                "now": min(now, d["goal"]),
                "done": now >= d["goal"],
            }
        )
    return rows


def check_task(db: Session, user: User, stat: DailyStat, key: str) -> int:
    """任务达标时自动发放奖励，返回加分（0 = 未达标或已发放）。"""
    d = next(t for t in TASK_DEFS if t["key"] == key)
    awarded_col = f"task_{key}_awarded"
    if getattr(stat, awarded_col):
        return 0
    if getattr(stat, _TASK_COL[key]) < d["goal"]:
        return 0
    setattr(stat, awarded_col, True)
    return add_points(db, user, d["pts"], f"每日任务 · {d['name']}", stat)
