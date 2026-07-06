from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.consultation_schemas import (
    DAY_END_HOUR,
    DAY_START_HOUR,
    AvailabilityRule,
    AvailabilityRuleRead,
    AvailabilityUpdate,
    ConsultationBlockCreate,
    ConsultationBlockRead,
    ConsultationCreate,
    ConsultationRead,
    ConsultationSlot,
    DaySlots,
)
from app.db import get_db
from app.models import (
    Consultation,
    ConsultationBlock,
    ConsultationStatus,
    ProfessorAvailability,
    User,
    UserRole,
)

router = APIRouter(prefix="/api/consultations", tags=["consultations"])

# Statuses that reserve a slot so nobody else can book it.
ACTIVE_STATUSES = (ConsultationStatus.pending, ConsultationStatus.approved)


def get_professor(db: Session) -> User:
    professor = db.scalar(select(User).where(User.role == UserRole.professor).order_by(User.created_at))
    if professor is None:
        raise HTTPException(status_code=404, detail="Seeded professor not found")
    return professor


def get_availability_map(db: Session, professor_id: UUID) -> dict[int, ProfessorAvailability]:
    rows = db.scalars(
        select(ProfessorAvailability).where(ProfessorAvailability.professor_id == professor_id)
    ).all()
    return {row.weekday: row for row in rows}


def compute_day_slots(db: Session, professor: User, target_date: date) -> DaySlots:
    weekday = target_date.weekday()
    availability = get_availability_map(db, professor.id).get(weekday)

    blocks = db.scalars(
        select(ConsultationBlock).where(
            ConsultationBlock.professor_id == professor.id,
            ConsultationBlock.block_date == target_date,
        )
    ).all()
    consultations = db.scalars(
        select(Consultation).where(
            Consultation.professor_id == professor.id,
            Consultation.consult_date == target_date,
            Consultation.status.in_(ACTIVE_STATUSES),
        )
    ).all()

    now = datetime.now()
    today = now.date()

    slots: list[ConsultationSlot] = []
    for hour in range(DAY_START_HOUR, DAY_END_HOUR):
        state = "available"
        reason: str | None = None
        student_id: str | None = None

        if target_date < today or (target_date == today and hour <= now.hour):
            state = "past"
        elif availability is None or not (availability.start_hour <= hour < availability.end_hour):
            state = "unavailable"
        else:
            for block in blocks:
                whole_day = block.start_hour is None or block.end_hour is None
                if whole_day or (block.start_hour <= hour < block.end_hour):
                    state = "blocked"
                    reason = block.reason
                    break

            if state == "available":
                for consultation in consultations:
                    if consultation.start_hour <= hour < consultation.end_hour:
                        state = consultation.status.value  # "pending" or "approved"
                        student_id = consultation.student_id
                        reason = consultation.reason or None
                        break

        slots.append(ConsultationSlot(hour=hour, state=state, reason=reason, studentId=student_id))

    return DaySlots(
        date=target_date,
        weekday=weekday,
        workingDay=availability is not None,
        slots=slots,
    )


# --- Weekly availability rules ---


@router.get("/availability", response_model=list[AvailabilityRuleRead])
def list_availability(db: Session = Depends(get_db)) -> list[ProfessorAvailability]:
    professor = get_professor(db)
    return list(
        db.scalars(
            select(ProfessorAvailability)
            .where(ProfessorAvailability.professor_id == professor.id)
            .order_by(ProfessorAvailability.weekday)
        ).all()
    )


@router.put("/availability", response_model=list[AvailabilityRuleRead])
def replace_availability(payload: AvailabilityUpdate, db: Session = Depends(get_db)) -> list[ProfessorAvailability]:
    professor = get_professor(db)
    seen: set[int] = set()
    for rule in payload.rules:
        if rule.weekday in seen:
            raise HTTPException(status_code=400, detail="Duplicate weekday in availability rules")
        seen.add(rule.weekday)

    existing = get_availability_map(db, professor.id)
    for row in existing.values():
        db.delete(row)
    db.flush()

    for rule in payload.rules:
        db.add(
            ProfessorAvailability(
                professor_id=professor.id,
                weekday=rule.weekday,
                start_hour=rule.start_hour,
                end_hour=rule.end_hour,
            )
        )
    db.commit()
    return list_availability(db)


# --- Ad-hoc date/time blocks ---


@router.get("/blocks", response_model=list[ConsultationBlockRead])
def list_blocks(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> list[ConsultationBlock]:
    professor = get_professor(db)
    stmt = select(ConsultationBlock).where(ConsultationBlock.professor_id == professor.id)
    if from_date is not None:
        stmt = stmt.where(ConsultationBlock.block_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(ConsultationBlock.block_date <= to_date)
    return list(db.scalars(stmt.order_by(ConsultationBlock.block_date, ConsultationBlock.start_hour)).all())


@router.post("/blocks", response_model=ConsultationBlockRead)
def create_block(payload: ConsultationBlockCreate, db: Session = Depends(get_db)) -> ConsultationBlock:
    professor = get_professor(db)
    block = ConsultationBlock(
        professor_id=professor.id,
        block_date=payload.block_date,
        start_hour=payload.start_hour,
        end_hour=payload.end_hour,
        reason=payload.reason,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.delete("/blocks/{block_id}")
def delete_block(block_id: UUID, db: Session = Depends(get_db)) -> dict[str, str]:
    professor = get_professor(db)
    block = db.scalar(
        select(ConsultationBlock).where(
            ConsultationBlock.id == block_id,
            ConsultationBlock.professor_id == professor.id,
        )
    )
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    db.delete(block)
    db.commit()
    return {"status": "deleted"}


# --- Slot availability for a single day ---


@router.get("/slots", response_model=DaySlots)
def get_slots(
    target_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
) -> DaySlots:
    professor = get_professor(db)
    return compute_day_slots(db, professor, target_date)


# --- Consultations (bookings) ---


@router.get("", response_model=list[ConsultationRead])
def list_consultations(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    status: ConsultationStatus | None = Query(default=None),
    student_id: str | None = Query(default=None, alias="studentId"),
    db: Session = Depends(get_db),
) -> list[Consultation]:
    professor = get_professor(db)
    stmt = select(Consultation).where(Consultation.professor_id == professor.id)
    if from_date is not None:
        stmt = stmt.where(Consultation.consult_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(Consultation.consult_date <= to_date)
    if status is not None:
        stmt = stmt.where(Consultation.status == status)
    if student_id:
        stmt = stmt.where(Consultation.student_id == student_id)
    return list(
        db.scalars(
            stmt.order_by(Consultation.consult_date, Consultation.start_hour)
        ).all()
    )


@router.post("", response_model=ConsultationRead)
def create_consultation(payload: ConsultationCreate, db: Session = Depends(get_db)) -> Consultation:
    professor = get_professor(db)

    # Re-check the requested slot against availability, blocks and existing bookings.
    day = compute_day_slots(db, professor, payload.consult_date)
    slot = next((item for item in day.slots if item.hour == payload.start_hour), None)
    if slot is None:
        raise HTTPException(status_code=400, detail="상담 가능 시간이 아닙니다.")
    if slot.state == "past":
        raise HTTPException(status_code=400, detail="이미 지난 시간은 예약할 수 없습니다.")
    if slot.state == "unavailable":
        raise HTTPException(status_code=400, detail="교수 근무 시간이 아니어서 예약할 수 없습니다.")
    if slot.state == "blocked":
        raise HTTPException(status_code=400, detail="교수가 차단한 시간입니다.")
    if slot.state in ("pending", "approved"):
        raise HTTPException(status_code=409, detail="이미 예약된 시간입니다.")

    consultation = Consultation(
        professor_id=professor.id,
        student_id=payload.student_id,
        student_name=payload.student_name,
        consult_date=payload.consult_date,
        start_hour=payload.start_hour,
        end_hour=payload.start_hour + 1,
        reason=payload.reason,
        status=ConsultationStatus.pending,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return consultation


def _get_consultation(db: Session, professor: User, consultation_id: UUID) -> Consultation:
    consultation = db.scalar(
        select(Consultation).where(
            Consultation.id == consultation_id,
            Consultation.professor_id == professor.id,
        )
    )
    if consultation is None:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return consultation


@router.post("/{consultation_id}/approve", response_model=ConsultationRead)
def approve_consultation(consultation_id: UUID, db: Session = Depends(get_db)) -> Consultation:
    professor = get_professor(db)
    consultation = _get_consultation(db, professor, consultation_id)

    # Guard against approving a slot that another approved booking already holds.
    conflict = db.scalar(
        select(Consultation).where(
            Consultation.professor_id == professor.id,
            Consultation.consult_date == consultation.consult_date,
            Consultation.start_hour == consultation.start_hour,
            Consultation.status == ConsultationStatus.approved,
            Consultation.id != consultation.id,
        )
    )
    if conflict is not None:
        raise HTTPException(status_code=409, detail="같은 시간에 이미 승인된 상담이 있습니다.")

    consultation.status = ConsultationStatus.approved
    db.commit()
    db.refresh(consultation)
    return consultation


@router.post("/{consultation_id}/reject", response_model=ConsultationRead)
def reject_consultation(consultation_id: UUID, db: Session = Depends(get_db)) -> Consultation:
    professor = get_professor(db)
    consultation = _get_consultation(db, professor, consultation_id)
    consultation.status = ConsultationStatus.rejected
    db.commit()
    db.refresh(consultation)
    return consultation


@router.delete("/{consultation_id}")
def delete_consultation(consultation_id: UUID, db: Session = Depends(get_db)) -> dict[str, str]:
    professor = get_professor(db)
    consultation = _get_consultation(db, professor, consultation_id)
    db.delete(consultation)
    db.commit()
    return {"status": "deleted"}
