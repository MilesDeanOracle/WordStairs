from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=20)
    password: str = Field(min_length=6, max_length=64)
    grade: str = "六年级"


class LoginIn(BaseModel):
    username: str
    password: str


class GradeIn(BaseModel):
    word_id: int
    level: str  # yes / fuzzy / no


class UseIn(BaseModel):
    user_id: int | None = None  # 管理员可为指定账号切换词书


class AnswerIn(BaseModel):
    mode: str  # listen / spell / scramble / speak
    word_id: int
    answer: str = ""
    score: int | None = None
    hint_used: bool = False  # 用过提示（如听音辨词刮开刮刮乐）：答对只加 1 分


class ImportIn(BaseModel):
    text: str
    unit_id: int


class BookIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    subtitle: str = Field(default="", max_length=120)
    stage: str = "primary"


class UnitIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class WordIn(BaseModel):
    text: str = Field(min_length=1, max_length=60)
    phonetic: str = Field(default="", max_length=80)
    pos: str = Field(default="", max_length=20)
    meaning: str = Field(min_length=1, max_length=120)
    example: str = Field(default="", max_length=240)
    example_cn: str = Field(default="", max_length=240)
    tip: str = Field(default="", max_length=240)
