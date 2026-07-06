import hashlib

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models import Consultation, ConsultationBlock, Exam, ProfessorAvailability, User, UserRole


# Default weekly consultation availability (weekday: 0=Mon ... 6=Sun).
# Tuesday(1) and Wednesday(2) and weekends are intentionally left out so they
# stay blocked by default until the professor opens them.
SEED_AVAILABILITY_WEEKDAYS = [0, 3, 4]  # Monday, Thursday, Friday
SEED_AVAILABILITY_START_HOUR = 9
SEED_AVAILABILITY_END_HOUR = 22


def password_hash(password: str) -> str:
    return hashlib.sha256(f"profpilot:{password}".encode()).hexdigest()


SEED_USERS = [
    *[
        {
            "username": f"prof{i:02d}",
            "email": f"prof{i:02d}@profpilot.local",
            "name": f"Professor {i:02d}",
            "role": UserRole.professor,
            "student_id": None,
            "password_hash": password_hash("1234"),
        }
        for i in range(1, 6)
    ],
    *[
        {
            "username": f"s2026{i:03d}",
            "email": f"s2026{i:03d}@profpilot.local",
            "name": f"Student {i:02d}",
            "role": UserRole.student,
            "student_id": f"2026{i:03d}",
            "password_hash": password_hash("1234"),
        }
        for i in range(1, 11)
    ],
]


def seed_database(db: Session) -> None:
    migrate_legacy_seed_users(db)

    for item in SEED_USERS:
        existing = db.scalar(select(User).where(User.username == item["username"]))
        if existing is None:
            existing = db.scalar(select(User).where(User.email == item["email"]))
        if existing is None and item["student_id"] is not None:
            existing = db.scalar(select(User).where(User.student_id == item["student_id"]))
        if existing is None:
            db.add(User(**item))
        else:
            for field, value in item.items():
                setattr(existing, field, value)
    db.commit()
    seed_availability(db)


def migrate_legacy_seed_users(db: Session) -> None:
    seed_by_username = {item["username"]: item for item in SEED_USERS}
    legacy_professor = db.scalar(
        select(User).where(
            or_(User.username.is_(None), User.username == "legacy_professor_1"),
            User.email == "professor@profpilot.local",
        )
    )
    if legacy_professor is not None:
        existing_professor = db.scalar(select(User).where(User.username == "prof01"))
        if existing_professor is not None and existing_professor.id != legacy_professor.id:
            reassign_professor_references(db, legacy_professor, existing_professor)
            db.delete(legacy_professor)
        else:
            promote_legacy_user(db, legacy_professor, seed_by_username["prof01"])

    for item in SEED_USERS:
        if item["student_id"] is None:
            continue
        legacy_student = db.scalar(
            select(User).where(
                User.username.is_(None),
                User.student_id == item["student_id"],
            )
        )
        if legacy_student is not None:
            promote_legacy_user(db, legacy_student, item)

    remaining_legacy_users = list(db.scalars(select(User).where(User.username.is_(None))).all())
    for index, user in enumerate(remaining_legacy_users, start=1):
        user.username = f"legacy_{user.role.value}_{index}"
        user.password_hash = password_hash("1234")
    db.commit()


def promote_legacy_user(db: Session, user: User, item: dict[str, object]) -> None:
    existing = db.scalar(select(User).where(User.username == item["username"]))
    if existing is not None and existing.id != user.id:
        return
    existing = db.scalar(select(User).where(User.email == item["email"]))
    if existing is not None and existing.id != user.id:
        return
    for field, value in item.items():
        setattr(user, field, value)


def reassign_professor_references(db: Session, source: User, target: User) -> None:
    db.execute(delete(ProfessorAvailability).where(ProfessorAvailability.professor_id == source.id))
    for model in (Exam, ConsultationBlock, Consultation):
        db.execute(
            update(model)
            .where(model.professor_id == source.id)
            .values(professor_id=target.id)
        )


def seed_availability(db: Session) -> None:
    professor = db.scalar(
        select(User).where(User.role == UserRole.professor).order_by(User.created_at)
    )
    if professor is None:
        return
    has_rules = db.scalar(
        select(ProfessorAvailability).where(ProfessorAvailability.professor_id == professor.id)
    )
    if has_rules is not None:
        return
    for weekday in SEED_AVAILABILITY_WEEKDAYS:
        db.add(
            ProfessorAvailability(
                professor_id=professor.id,
                weekday=weekday,
                start_hour=SEED_AVAILABILITY_START_HOUR,
                end_hour=SEED_AVAILABILITY_END_HOUR,
            )
        )
    db.commit()
