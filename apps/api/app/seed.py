from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserRole


SEED_USERS = [
    {
        "email": "professor@profpilot.local",
        "name": "Professor Kim",
        "role": UserRole.professor,
        "student_id": None,
    },
    {
        "email": "s2026001@profpilot.local",
        "name": "Student Lee",
        "role": UserRole.student,
        "student_id": "2026001",
    },
    {
        "email": "s2026002@profpilot.local",
        "name": "Student Park",
        "role": UserRole.student,
        "student_id": "2026002",
    },
]


def seed_database(db: Session) -> None:
    for item in SEED_USERS:
        existing = db.scalar(select(User).where(User.email == item["email"]))
        if existing is None:
            db.add(User(**item))
    db.commit()
