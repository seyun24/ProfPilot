from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(80)"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128) NOT NULL DEFAULT ''"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
        connection.execute(text("ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER"))
        connection.execute(
            text(
                "DO $$ BEGIN "
                "CREATE TYPE grading_status AS ENUM ('pending', 'graded'); "
                "EXCEPTION WHEN duplicate_object THEN null; "
                "END $$;"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE submissions "
                "ADD COLUMN IF NOT EXISTS grading_status grading_status NOT NULL DEFAULT 'pending'"
            )
        )
        connection.execute(text("ALTER TABLE submission_answers ADD COLUMN IF NOT EXISTS feedback TEXT"))
