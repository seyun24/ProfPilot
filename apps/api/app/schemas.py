from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models import QuestionType, UserRole


class CamelModel(BaseModel):
    """Base model that serializes to camelCase while accepting snake_case input."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str


class UserRead(BaseModel):
    id: UUID
    username: str
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


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: UserRead


# --- AI: metadata shared by every AI response ---


class AIMeta(CamelModel):
    provider: str = Field(description="'openai' when a real model was used, 'mock' otherwise")
    model: str
    mocked: bool


# --- AI: exam question review (POST /ai/exam-review) ---


class ExamReviewRequest(CamelModel):
    question_text: str = Field(min_length=1)
    question_type: QuestionType
    choices: list[str] | None = None
    correct_answer: object | None = Field(
        default=None,
        description="Optional professor-provided answer. Never returned to students.",
    )


class ExamReviewResult(CamelModel):
    typo_issues: list[str] = Field(default_factory=list)
    grammar_issues: list[str] = Field(default_factory=list)
    ambiguous_expressions: list[str] = Field(default_factory=list)
    duplicate_choices: list[str] = Field(default_factory=list)
    answer_conflict: str | None = None
    difficulty_opinion: str = ""
    estimated_solving_time_seconds: int = 0
    suggested_warnings: list[str] = Field(default_factory=list)


class ExamReviewResponse(CamelModel):
    review: ExamReviewResult
    meta: AIMeta


# --- AI: consultation note summary (POST /ai/consultation-summary) ---


class ConsultationSummaryRequest(CamelModel):
    note: str = Field(min_length=1, description="Raw consultation note written by the professor")


class ConsultationSummaryResult(CamelModel):
    summary: str = ""
    action_items: list[str] = Field(default_factory=list)
    next_meeting_recommendation: str = ""


class ConsultationSummaryResponse(CamelModel):
    result: ConsultationSummaryResult
    meta: AIMeta


# --- AI: graduation project weekly report summary (POST /ai/project-report-summary) ---


class ProjectReportSummaryRequest(CamelModel):
    report: str = Field(min_length=1, description="Raw weekly report text from the team")


class ProjectReportSummaryResult(CamelModel):
    summary: str = ""
    progress: str = ""
    risks: list[str] = Field(default_factory=list)
    professor_feedback_draft: str = ""


class ProjectReportSummaryResponse(CamelModel):
    result: ProjectReportSummaryResult
    meta: AIMeta
