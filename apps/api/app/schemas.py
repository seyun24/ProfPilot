from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str


class UserRead(BaseModel):
    id: UUID
    email: str
    name: str
    role: UserRole
    student_id: str | None = Field(default=None, serialization_alias="studentId")
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SeedStatus(BaseModel):
    users: int
    professors: int
    students: int
