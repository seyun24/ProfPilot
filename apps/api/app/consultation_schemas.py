from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import ConsultationStatus

# Consultation booking day window (inclusive start, exclusive end).
DAY_START_HOUR = 9
DAY_END_HOUR = 22


class AvailabilityRule(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0=Monday ... 6=Sunday")
    start_hour: int = Field(default=DAY_START_HOUR, ge=DAY_START_HOUR, le=DAY_END_HOUR, alias="startHour")
    end_hour: int = Field(default=DAY_END_HOUR, ge=DAY_START_HOUR, le=DAY_END_HOUR, alias="endHour")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def check_hours(self) -> "AvailabilityRule":
        if self.end_hour <= self.start_hour:
            raise ValueError("endHour must be greater than startHour")
        return self


class AvailabilityRuleRead(AvailabilityRule):
    id: UUID

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AvailabilityUpdate(BaseModel):
    rules: list[AvailabilityRule]


class ConsultationBlockCreate(BaseModel):
    block_date: date = Field(alias="date")
    start_hour: int | None = Field(default=None, alias="startHour")
    end_hour: int | None = Field(default=None, alias="endHour")
    reason: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def check_hours(self) -> "ConsultationBlockCreate":
        if (self.start_hour is None) != (self.end_hour is None):
            raise ValueError("startHour and endHour must both be set or both be empty")
        if self.start_hour is not None and self.end_hour is not None and self.end_hour <= self.start_hour:
            raise ValueError("endHour must be greater than startHour")
        return self


class ConsultationBlockRead(BaseModel):
    id: UUID
    block_date: date = Field(alias="date")
    start_hour: int | None = Field(alias="startHour")
    end_hour: int | None = Field(alias="endHour")
    reason: str | None
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ConsultationCreate(BaseModel):
    student_id: str = Field(alias="studentId", min_length=1)
    student_name: str | None = Field(default=None, alias="studentName")
    consult_date: date = Field(alias="date")
    start_hour: int = Field(alias="startHour", ge=DAY_START_HOUR, le=DAY_END_HOUR - 1)
    reason: str = ""

    model_config = ConfigDict(populate_by_name=True)


class ConsultationRead(BaseModel):
    id: UUID
    student_id: str = Field(alias="studentId")
    student_name: str | None = Field(alias="studentName")
    consult_date: date = Field(alias="date")
    start_hour: int = Field(alias="startHour")
    end_hour: int = Field(alias="endHour")
    reason: str
    status: ConsultationStatus
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ConsultationSlot(BaseModel):
    hour: int
    # available | unavailable | blocked | pending | approved | past
    state: str
    reason: str | None = None
    student_id: str | None = Field(default=None, alias="studentId")

    model_config = ConfigDict(populate_by_name=True)


class DaySlots(BaseModel):
    consult_date: date = Field(alias="date")
    weekday: int
    working_day: bool = Field(alias="workingDay")
    slots: list[ConsultationSlot]

    model_config = ConfigDict(populate_by_name=True)
