"""简化 SM-2 间隔重复。

认识   ：连对序列推进间隔 1 → 3 → 7 → interval × ease，ease 上调
想了一下：间隔减半（至少明天），ease 小幅下调
不认识 ：重置为明天重现，lapses +1
"""
from datetime import date, timedelta

from .models import UserWord


def apply_grade(uw: UserWord, level: str, today: date | None = None) -> None:
    today = today or date.today()

    if level == "yes":
        uw.streak += 1
        if uw.streak == 1:
            uw.interval_days = 1
        elif uw.streak == 2:
            uw.interval_days = 3
        elif uw.streak == 3:
            uw.interval_days = 7
        else:
            uw.interval_days = min(180, round(uw.interval_days * uw.ease) or 7)
        uw.ease = min(2.8, uw.ease + 0.02)
    elif level == "fuzzy":
        uw.streak = 0
        uw.interval_days = max(1, uw.interval_days // 2)
        uw.ease = max(1.3, uw.ease - 0.1)
    else:  # no
        uw.streak = 0
        uw.interval_days = 1
        uw.lapses += 1
        uw.ease = max(1.3, uw.ease - 0.2)

    uw.learned = True
    uw.due_at = today + timedelta(days=uw.interval_days)
