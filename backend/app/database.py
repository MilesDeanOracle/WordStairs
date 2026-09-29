from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = os_path = __file__.replace("\\", "/").rsplit("/", 1)[0] + "/../app.db"

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def migrate() -> None:
    """轻量迁移：老库补新列。"""
    from sqlalchemy import text

    with engine.connect() as conn:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)"))]
        if cols and "is_admin" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
