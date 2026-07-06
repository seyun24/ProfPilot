from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import ExamStatus, GradingStatus, QuestionType, SubmissionStatus


class ExamCreate(BaseModel):
    title: str
    description: str = ""
    duration_minutes: int | None = Field(default=None, alias="durationMinutes")
    starts_at: datetime | None = Field(default=None, alias="startsAt")
    ends_at: datetime | None = Field(default=None, alias="endsAt")

    model_config = ConfigDict(populate_by_name=True)


class ExamUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    duration_minutes: int | None = Field(default=None, alias="durationMinutes")
    starts_at: datetime | None = Field(default=None, alias="startsAt")
    ends_at: datetime | None = Field(default=None, alias="endsAt")

    model_config = ConfigDict(populate_by_name=True)


class QuestionCreate(BaseModel):
    type: QuestionType
    prompt: str
    image_url: str | None = Field(default=None, alias="imageUrl")
    points: int = 1
    order_index: int = Field(default=0, alias="orderIndex")
    options: list[str] | None = None
    correct_answer: Any | None = Field(default=None, alias="correctAnswer")

    model_config = ConfigDict(populate_by_name=True)


class QuestionUpdate(BaseModel):
    type: QuestionType | None = None
    prompt: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")
    points: int | None = None
    order_index: int | None = Field(default=None, alias="orderIndex")
    options: list[str] | None = None
    correct_answer: Any | None = Field(default=None, alias="correctAnswer")

    model_config = ConfigDict(populate_by_name=True)


class QuestionRead(BaseModel):
    id: UUID
    exam_id: UUID = Field(alias="examId")
    type: QuestionType
    prompt: str
    image_url: str | None = Field(alias="imageUrl")
    points: int
    order_index: int = Field(alias="orderIndex")
    options: list[str] | None
    correct_answer: Any | None = Field(alias="correctAnswer")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class StudentQuestionRead(BaseModel):
    id: UUID
    type: QuestionType
    prompt: str
    image_url: str | None = Field(alias="imageUrl")
    points: int
    order_index: int = Field(alias="orderIndex")
    options: list[str] | None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ExamRead(BaseModel):
    id: UUID
    title: str
    description: str
    status: ExamStatus
    exam_code: str | None = Field(alias="examCode")
    duration_minutes: int | None = Field(alias="durationMinutes")
    starts_at: datetime | None = Field(alias="startsAt")
    ends_at: datetime | None = Field(alias="endsAt")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    questions: list[QuestionRead] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class StudentExamRead(BaseModel):
    id: UUID
    title: str
    description: str
    exam_code: str | None = Field(alias="examCode")
    duration_minutes: int | None = Field(alias="durationMinutes")
    questions: list[StudentQuestionRead]

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AllowedStudentCreate(BaseModel):
    student_id: str = Field(alias="studentId")
    student_name: str | None = Field(default=None, alias="studentName")

    model_config = ConfigDict(populate_by_name=True)


class AllowedStudentUpdate(BaseModel):
    student_id: str | None = Field(default=None, alias="studentId")
    student_name: str | None = Field(default=None, alias="studentName")

    model_config = ConfigDict(populate_by_name=True)


class AllowedStudentBulkCreate(BaseModel):
    students: list[AllowedStudentCreate]


class AllowedStudentRead(BaseModel):
    id: UUID
    exam_id: UUID = Field(alias="examId")
    student_id: str = Field(alias="studentId")
    student_name: str | None = Field(alias="studentName")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class StudentExamValidateRequest(BaseModel):
    student_id: str = Field(alias="studentId")
    exam_code: str = Field(alias="examCode")

    model_config = ConfigDict(populate_by_name=True)


class StudentExamValidateResponse(BaseModel):
    exam_id: UUID = Field(alias="examId")
    submission_id: UUID = Field(alias="submissionId")
    title: str

    model_config = ConfigDict(populate_by_name=True)


class AnswerInput(BaseModel):
    question_id: UUID = Field(alias="questionId")
    answer: Any | None = None

    model_config = ConfigDict(populate_by_name=True)


class SaveAnswersRequest(BaseModel):
    student_id: str = Field(alias="studentId")
    answers: list[AnswerInput]

    model_config = ConfigDict(populate_by_name=True)


class SubmitExamRequest(SaveAnswersRequest):
    pass


class SubmissionAnswerRead(BaseModel):
    id: UUID
    question_id: UUID = Field(alias="questionId")
    answer: Any | None
    is_correct: bool | None = Field(alias="isCorrect")
    score: float | None
    needs_manual_grading: bool = Field(alias="needsManualGrading")
    feedback: str | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SubmissionRead(BaseModel):
    id: UUID
    exam_id: UUID = Field(alias="examId")
    student_id: str = Field(alias="studentId")
    status: SubmissionStatus
    grading_status: GradingStatus = Field(alias="gradingStatus")
    total_score: float | None = Field(alias="totalScore")
    objective_score: float | None = Field(alias="objectiveScore")
    manual_score: float | None = Field(alias="manualScore")
    submitted_at: datetime | None = Field(alias="submittedAt")
    answers: list[SubmissionAnswerRead] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ManualAnswerScoreUpdate(BaseModel):
    score: float
    feedback: str | None = None


class ExamStatistics(BaseModel):
    exam_id: UUID = Field(alias="examId")
    submissions: int
    submitted: int
    graded: int
    pending_grading: int = Field(alias="pendingGrading")
    pending_manual_grading: int = Field(alias="pendingManualGrading")
    average_objective_score: float = Field(alias="averageObjectiveScore")
    max_points: int = Field(alias="maxPoints")
    question_stats: list[dict[str, Any]] = Field(alias="questionStats")

    model_config = ConfigDict(populate_by_name=True)


class StudentResultRequest(BaseModel):
    student_id: str = Field(alias="studentId")
    exam_code: str = Field(alias="examCode")

    model_config = ConfigDict(populate_by_name=True)


class StudentResultAnswerRead(BaseModel):
    question_id: UUID = Field(alias="questionId")
    type: QuestionType
    prompt: str
    image_url: str | None = Field(alias="imageUrl")
    points: int
    order_index: int = Field(alias="orderIndex")
    options: list[str] | None
    answer: Any | None
    correct_answer: Any | None = Field(alias="correctAnswer")
    is_correct: bool | None = Field(alias="isCorrect")
    score: float | None
    needs_manual_grading: bool = Field(alias="needsManualGrading")
    feedback: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class StudentResultRead(BaseModel):
    exam_id: UUID = Field(alias="examId")
    title: str
    student_id: str = Field(alias="studentId")
    status: SubmissionStatus
    grading_status: GradingStatus = Field(alias="gradingStatus")
    total_score: float | None = Field(alias="totalScore")
    objective_score: float | None = Field(alias="objectiveScore")
    manual_score: float | None = Field(alias="manualScore")
    max_points: int = Field(alias="maxPoints")
    submitted_at: datetime | None = Field(alias="submittedAt")
    answers: list[StudentResultAnswerRead]

    model_config = ConfigDict(populate_by_name=True)
