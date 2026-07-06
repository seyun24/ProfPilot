import hashlib

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Header, HTTPException

from app.db import get_db
from app.models import User, UserRole
from app.schemas import LoginRequest, LoginResponse, SeedStatus, UserRead

router = APIRouter(prefix="/api", tags=["users"])


def password_hash(password: str) -> str:
    return hashlib.sha256(f"profpilot:{password}".encode()).hexdigest()


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.username == payload.username.strip()))
    if user is None or user.password_hash != password_hash(payload.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    return LoginResponse(user=user)


@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.role, User.name)).all())


@router.get("/me", response_model=UserRead)
def get_current_demo_user(
    x_demo_role: UserRole = Header(default=UserRole.professor),
    db: Session = Depends(get_db),
) -> User:
    user = db.scalar(select(User).where(User.role == x_demo_role).order_by(User.created_at))
    if user is None:
        raise HTTPException(status_code=404, detail="No seeded user found for role")
    return user


@router.get("/seed-status", response_model=SeedStatus)
def seed_status(db: Session = Depends(get_db)) -> SeedStatus:
    users = db.scalar(select(func.count()).select_from(User)) or 0
    professors = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.professor)) or 0
    students = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.student)) or 0
    return SeedStatus(users=users, professors=professors, students=students)
