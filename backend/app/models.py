from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    grade: Mapped[str] = mapped_column(String(20), default="六年级")
    current_book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id"), nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    last_study_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    subtitle: Mapped[str] = mapped_column(String(120), default="")
    stage: Mapped[str] = mapped_column(String(12), default="primary")  # primary/junior/senior/other


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    order_no: Mapped[int] = mapped_column(Integer, default=0)


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    phonetic: Mapped[str] = mapped_column(String(80), default="")
    pos: Mapped[str] = mapped_column(String(20), default="")
    meaning: Mapped[str] = mapped_column(String(120))
    example: Mapped[str] = mapped_column(String(240), default="")
    example_cn: Mapped[str] = mapped_column(String(240), default="")
    tip: Mapped[str] = mapped_column(String(240), default="")


class BookWord(Base):
    __tablename__ = "book_words"
    __table_args__ = (UniqueConstraint("unit_id", "word_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    order_no: Mapped[int] = mapped_column(Integer, default=0)


class UnitScope(Base):
    """每个学生对每个单元的学习/练习开关。无记录 = 未启用。"""
    __tablename__ = "unit_scopes"
    __table_args__ = (UniqueConstraint("user_id", "unit_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    study: Mapped[bool] = mapped_column(Boolean, default=True)
    practice: Mapped[bool] = mapped_column(Boolean, default=True)


class UserWord(Base):
    __tablename__ = "user_words"
    __table_args__ = (UniqueConstraint("user_id", "word_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    ease: Mapped[float] = mapped_column(Float, default=2.5)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    learned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    mode: Mapped[str] = mapped_column(String(12))  # card/listen/spell/scramble/speak
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PointsLedger(Base):
    __tablename__ = "points_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DailyStat(Base):
    __tablename__ = "daily_stats"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    words_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    spell_done: Mapped[int] = mapped_column(Integer, default=0)
    speak_done: Mapped[int] = mapped_column(Integer, default=0)
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    task_words_awarded: Mapped[bool] = mapped_column(Boolean, default=False)
    task_spell_awarded: Mapped[bool] = mapped_column(Boolean, default=False)
    task_speak_awarded: Mapped[bool] = mapped_column(Boolean, default=False)
