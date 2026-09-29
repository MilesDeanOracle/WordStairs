import os

SECRET_KEY = os.environ.get("CIJIE_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_HOURS = 72

DAILY_CAP = 300        # 每日积分上限（防刷）
DAILY_GOAL = 20        # 今日复习目标（词）
NEW_PER_DAY = 10       # 每日新词上限
REVIEW_PER_DAY = 30    # 每日复习上限
