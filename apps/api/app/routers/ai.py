from fastapi import APIRouter

from app import ai_service
from app.schemas import (
    ConsultationSummaryRequest,
    ConsultationSummaryResponse,
    ExamReviewRequest,
    ExamReviewResponse,
    ProjectReportSummaryRequest,
    ProjectReportSummaryResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/exam-review", response_model=ExamReviewResponse)
def exam_review(payload: ExamReviewRequest) -> ExamReviewResponse:
    """Review a professor-written exam question. Never creates questions or answers."""
    review, meta = ai_service.review_exam_question(payload)
    return ExamReviewResponse(review=review, meta=meta)


@router.post("/consultation-summary", response_model=ConsultationSummaryResponse)
def consultation_summary(payload: ConsultationSummaryRequest) -> ConsultationSummaryResponse:
    """Summarize a consultation note and suggest action items."""
    result, meta = ai_service.summarize_consultation(payload)
    return ConsultationSummaryResponse(result=result, meta=meta)


@router.post("/project-report-summary", response_model=ProjectReportSummaryResponse)
def project_report_summary(payload: ProjectReportSummaryRequest) -> ProjectReportSummaryResponse:
    """Summarize a weekly graduation-project report and draft feedback. Never grades."""
    result, meta = ai_service.summarize_project_report(payload)
    return ProjectReportSummaryResponse(result=result, meta=meta)
