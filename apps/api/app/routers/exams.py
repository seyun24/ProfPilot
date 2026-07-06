import secrets
import shutil
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.exam_schemas import (
    AllowedStudentBulkCreate,
    AllowedStudentCreate,
    AllowedStudentRead,
    AllowedStudentUpdate,
    ExamCreate,
    ExamRead,
    ExamStatistics,
    ExamUpdate,
    ManualAnswerScoreUpdate,
    QuestionCreate,
    QuestionRead,
    QuestionUpdate,
    SaveAnswersRequest,
    StudentExamRead,
    StudentExamValidateRequest,
    StudentExamValidateResponse,
    StudentResultAnswerRead,
    StudentResultRead,
    StudentResultRequest,
    SubmissionRead,
    SubmitExamRequest,
)
from app.grading import apply_grading
from app.models import (
    Exam,
    ExamAllowedStudent,
    ExamStatus,
    GradingStatus,
    Question,
    QuestionType,
    Submission,
    SubmissionAnswer,
    SubmissionStatus,
    User,
    UserRole,
)

router = APIRouter(prefix="/api", tags=["exams"])
UPLOAD_DIR = Path("uploads/questions")


def get_professor(db: Session) -> User:
    professor = db.scalar(select(User).where(User.role == UserRole.professor).order_by(User.created_at))
    if professor is None:
        raise HTTPException(status_code=404, detail="Seeded professor not found")
    return professor


def get_exam_or_404(db: Session, exam_id: UUID, include_questions: bool = False) -> Exam:
    stmt = select(Exam).where(Exam.id == exam_id)
    if include_questions:
        stmt = stmt.options(selectinload(Exam.questions))
    exam = db.scalar(stmt)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


def generate_exam_code(db: Session) -> str:
    for _ in range(20):
        code = secrets.token_urlsafe(5).replace("-", "").replace("_", "").upper()[:8]
        if db.scalar(select(Exam).where(Exam.exam_code == code)) is None:
            return code
    raise HTTPException(status_code=500, detail="Could not generate exam code")


def validate_exam_open(exam: Exam) -> None:
    now = datetime.now(timezone.utc)
    if exam.status != ExamStatus.published:
        raise HTTPException(status_code=403, detail="Exam is not open")
    if exam.starts_at and exam.starts_at > now:
        raise HTTPException(status_code=403, detail="Exam has not started")
    if exam.ends_at and exam.ends_at < now:
        raise HTTPException(status_code=403, detail="Exam has ended")


def ensure_student_allowed(db: Session, exam_id: UUID, student_id: str) -> None:
    allowed = db.scalar(
        select(ExamAllowedStudent).where(
            ExamAllowedStudent.exam_id == exam_id,
            ExamAllowedStudent.student_id == student_id,
        )
    )
    if allowed is None:
        raise HTTPException(status_code=403, detail="등록된 응시자가 아닙니다.")


def get_or_create_submission(db: Session, exam: Exam, student_id: str) -> Submission:
    submission = db.scalar(
        select(Submission).where(
            Submission.exam_id == exam.id,
            Submission.student_id == student_id,
        )
    )
    if submission and submission.status == SubmissionStatus.submitted:
        raise HTTPException(status_code=409, detail="Exam already submitted")
    if submission is None:
        submission = Submission(exam_id=exam.id, student_id=student_id)
        db.add(submission)
        db.flush()
    return submission


def save_answers(db: Session, submission: Submission, payload: SaveAnswersRequest) -> None:
    existing = {
        str(answer.question_id): answer
        for answer in db.scalars(select(SubmissionAnswer).where(SubmissionAnswer.submission_id == submission.id)).all()
    }

    for item in payload.answers:
        key = str(item.question_id)
        current = existing.get(key)
        if current:
            current.answer = item.answer
        else:
            db.add(
                SubmissionAnswer(
                    submission_id=submission.id,
                    question_id=item.question_id,
                    answer=item.answer,
                )
            )


def load_submission_with_answers(db: Session, submission_id: UUID) -> Submission:
    submission = db.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.answers))
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


def recalculate_submission_scores(db: Session, submission: Submission) -> None:
    answers = list(
        db.scalars(
            select(SubmissionAnswer)
            .where(SubmissionAnswer.submission_id == submission.id)
            .options(selectinload(SubmissionAnswer.question))
        ).all()
    )
    objective_score = Decimal("0")
    manual_score = Decimal("0")
    has_manual_pending = False

    for answer in answers:
        if answer.needs_manual_grading or answer.score is None:
            has_manual_pending = True
            continue
        score = Decimal(str(answer.score))
        if answer.question.type in (QuestionType.essay, QuestionType.short_answer):
            manual_score += score
        else:
            objective_score += score

    submission.objective_score = objective_score
    submission.manual_score = None if has_manual_pending else manual_score
    submission.total_score = objective_score + manual_score
    submission.grading_status = GradingStatus.pending if has_manual_pending else GradingStatus.graded


@router.get("/exams", response_model=list[ExamRead])
def list_exams(db: Session = Depends(get_db)) -> list[Exam]:
    return list(
        db.scalars(
            select(Exam)
            .options(selectinload(Exam.questions))
            .order_by(Exam.created_at.desc())
        ).all()
    )


@router.post("/exams", response_model=ExamRead)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)) -> Exam:
    professor = get_professor(db)
    exam = Exam(
        professor_id=professor.id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return get_exam_or_404(db, exam.id, include_questions=True)


@router.get("/exams/{exam_id}", response_model=ExamRead)
def get_exam(exam_id: UUID, db: Session = Depends(get_db)) -> Exam:
    return get_exam_or_404(db, exam_id, include_questions=True)


@router.patch("/exams/{exam_id}", response_model=ExamRead)
def update_exam(exam_id: UUID, payload: ExamUpdate, db: Session = Depends(get_db)) -> Exam:
    exam = get_exam_or_404(db, exam_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)
    db.commit()
    return get_exam_or_404(db, exam_id, include_questions=True)


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: UUID, db: Session = Depends(get_db)) -> dict[str, str]:
    exam = get_exam_or_404(db, exam_id)
    db.delete(exam)
    db.commit()
    return {"status": "deleted"}


@router.post("/exams/{exam_id}/publish", response_model=ExamRead)
def publish_exam(exam_id: UUID, db: Session = Depends(get_db)) -> Exam:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    if not exam.questions:
        raise HTTPException(status_code=400, detail="Cannot publish exam without questions")
    if exam.exam_code is None:
        exam.exam_code = generate_exam_code(db)
    exam.status = ExamStatus.published
    db.commit()
    return get_exam_or_404(db, exam_id, include_questions=True)


@router.post("/exams/{exam_id}/close", response_model=ExamRead)
def close_exam(exam_id: UUID, db: Session = Depends(get_db)) -> Exam:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    exam.status = ExamStatus.closed
    db.commit()
    return get_exam_or_404(db, exam_id, include_questions=True)


@router.get("/exams/{exam_id}/questions", response_model=list[QuestionRead])
def list_questions(exam_id: UUID, db: Session = Depends(get_db)) -> list[Question]:
    get_exam_or_404(db, exam_id)
    return list(db.scalars(select(Question).where(Question.exam_id == exam_id).order_by(Question.order_index)).all())


@router.post("/exams/{exam_id}/questions", response_model=QuestionRead)
def create_question(exam_id: UUID, payload: QuestionCreate, db: Session = Depends(get_db)) -> Question:
    get_exam_or_404(db, exam_id)
    question = Question(exam_id=exam_id, **payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.patch("/questions/{question_id}", response_model=QuestionRead)
def update_question(question_id: UUID, payload: QuestionUpdate, db: Session = Depends(get_db)) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return question


@router.delete("/questions/{question_id}")
def delete_question(question_id: UUID, db: Session = Depends(get_db)) -> dict[str, str]:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()
    return {"status": "deleted"}


@router.post("/questions/{question_id}/image", response_model=QuestionRead)
def upload_question_image(
    question_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "image").suffix or ".bin"
    filename = f"{question_id}{suffix}"
    target = UPLOAD_DIR / filename
    with target.open("wb") as output:
        shutil.copyfileobj(file.file, output)
    question.image_url = f"/uploads/questions/{filename}"
    db.commit()
    db.refresh(question)
    return question


@router.get("/exams/{exam_id}/allowed-students", response_model=list[AllowedStudentRead])
def list_allowed_students(exam_id: UUID, db: Session = Depends(get_db)) -> list[ExamAllowedStudent]:
    get_exam_or_404(db, exam_id)
    return list(
        db.scalars(
            select(ExamAllowedStudent)
            .where(ExamAllowedStudent.exam_id == exam_id)
            .order_by(ExamAllowedStudent.student_id)
        ).all()
    )


@router.post("/exams/{exam_id}/allowed-students", response_model=AllowedStudentRead)
def add_allowed_student(
    exam_id: UUID,
    payload: AllowedStudentCreate,
    db: Session = Depends(get_db),
) -> ExamAllowedStudent:
    get_exam_or_404(db, exam_id)
    existing = db.scalar(
        select(ExamAllowedStudent).where(
            ExamAllowedStudent.exam_id == exam_id,
            ExamAllowedStudent.student_id == payload.student_id,
        )
    )
    if existing:
        return existing
    allowed = ExamAllowedStudent(
        exam_id=exam_id,
        student_id=payload.student_id,
        student_name=payload.student_name,
    )
    db.add(allowed)
    db.commit()
    db.refresh(allowed)
    return allowed


@router.post("/exams/{exam_id}/allowed-students/bulk", response_model=list[AllowedStudentRead])
def add_allowed_students_bulk(
    exam_id: UUID,
    payload: AllowedStudentBulkCreate,
    db: Session = Depends(get_db),
) -> list[ExamAllowedStudent]:
    get_exam_or_404(db, exam_id)
    for student in payload.students:
        existing = db.scalar(
            select(ExamAllowedStudent).where(
                ExamAllowedStudent.exam_id == exam_id,
                ExamAllowedStudent.student_id == student.student_id,
            )
        )
        if existing is None:
            db.add(
                ExamAllowedStudent(
                    exam_id=exam_id,
                    student_id=student.student_id,
                    student_name=student.student_name,
                )
            )
    db.commit()
    return list_allowed_students(exam_id, db)


@router.patch("/exams/{exam_id}/allowed-students/{allowed_student_id}", response_model=AllowedStudentRead)
def update_allowed_student(
    exam_id: UUID,
    allowed_student_id: UUID,
    payload: AllowedStudentUpdate,
    db: Session = Depends(get_db),
) -> ExamAllowedStudent:
    get_exam_or_404(db, exam_id)
    allowed = db.scalar(
        select(ExamAllowedStudent).where(
            ExamAllowedStudent.id == allowed_student_id,
            ExamAllowedStudent.exam_id == exam_id,
        )
    )
    if allowed is None:
        raise HTTPException(status_code=404, detail="Allowed student not found")

    updates = payload.model_dump(exclude_unset=True)
    next_student_id = updates.get("student_id")
    if next_student_id and next_student_id != allowed.student_id:
        existing = db.scalar(
            select(ExamAllowedStudent).where(
                ExamAllowedStudent.exam_id == exam_id,
                ExamAllowedStudent.student_id == next_student_id,
                ExamAllowedStudent.id != allowed_student_id,
            )
        )
        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 학번입니다.")

    for field, value in updates.items():
        setattr(allowed, field, value)

    db.commit()
    db.refresh(allowed)
    return allowed


@router.delete("/exams/{exam_id}/allowed-students/{allowed_student_id}")
def delete_allowed_student(
    exam_id: UUID,
    allowed_student_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    get_exam_or_404(db, exam_id)
    allowed = db.scalar(
        select(ExamAllowedStudent).where(
            ExamAllowedStudent.id == allowed_student_id,
            ExamAllowedStudent.exam_id == exam_id,
        )
    )
    if allowed is None:
        raise HTTPException(status_code=404, detail="Allowed student not found")
    db.delete(allowed)
    db.commit()
    return {"status": "deleted"}


@router.get("/exams/{exam_id}/submissions", response_model=list[SubmissionRead])
def list_submissions(exam_id: UUID, db: Session = Depends(get_db)) -> list[Submission]:
    get_exam_or_404(db, exam_id)
    return list(
        db.scalars(
            select(Submission)
            .where(Submission.exam_id == exam_id)
            .options(selectinload(Submission.answers))
            .order_by(Submission.created_at.desc())
        ).all()
    )


@router.get("/exams/{exam_id}/results", response_model=list[SubmissionRead])
def exam_results(exam_id: UUID, db: Session = Depends(get_db)) -> list[Submission]:
    return list_submissions(exam_id, db)


@router.get("/exams/{exam_id}/statistics", response_model=ExamStatistics)
def exam_statistics(exam_id: UUID, db: Session = Depends(get_db)) -> ExamStatistics:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    submissions = list_submissions(exam_id, db)
    submitted = [item for item in submissions if item.status == SubmissionStatus.submitted]
    graded = [item for item in submitted if item.grading_status == GradingStatus.graded]
    objective_scores = [float(item.objective_score or 0) for item in graded]
    pending_manual = sum(
        1
        for item in submitted
        if any(answer.needs_manual_grading for answer in item.answers)
    )
    question_stats: list[dict[str, object]] = []
    for question in exam.questions:
        answers = [
            answer
            for submission in submitted
            for answer in submission.answers
            if answer.question_id == question.id
        ]
        question_stats.append(
            {
                "questionId": str(question.id),
                "type": question.type,
                "prompt": question.prompt,
                "answered": len(answers),
                "correct": sum(1 for answer in answers if answer.is_correct is True),
                "manualPending": sum(1 for answer in answers if answer.needs_manual_grading),
            }
        )
    return ExamStatistics(
        examId=exam.id,
        submissions=len(submissions),
        submitted=len(submitted),
        graded=len(graded),
        pendingGrading=sum(1 for item in submitted if item.grading_status == GradingStatus.pending),
        pendingManualGrading=pending_manual,
        averageObjectiveScore=sum(objective_scores) / len(objective_scores) if objective_scores else 0,
        maxPoints=sum(question.points for question in exam.questions),
        questionStats=question_stats,
    )


@router.post("/student/exams/validate", response_model=StudentExamValidateResponse)
def validate_student_exam(
    payload: StudentExamValidateRequest,
    db: Session = Depends(get_db),
) -> StudentExamValidateResponse:
    exam = db.scalar(select(Exam).where(Exam.exam_code == payload.exam_code))
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam code not found")
    validate_exam_open(exam)
    ensure_student_allowed(db, exam.id, payload.student_id)
    submission = get_or_create_submission(db, exam, payload.student_id)
    db.commit()
    return StudentExamValidateResponse(examId=exam.id, submissionId=submission.id, title=exam.title)


@router.post("/student/results", response_model=StudentResultRead)
def get_student_result(
    payload: StudentResultRequest,
    db: Session = Depends(get_db),
) -> StudentResultRead:
    exam = db.scalar(
        select(Exam)
        .where(Exam.exam_code == payload.exam_code)
        .options(selectinload(Exam.questions))
    )
    if exam is None:
        raise HTTPException(status_code=404, detail="시험 코드를 찾지 못했습니다.")
    ensure_student_allowed(db, exam.id, payload.student_id)

    submission = db.scalar(
        select(Submission)
        .where(
            Submission.exam_id == exam.id,
            Submission.student_id == payload.student_id,
        )
        .options(selectinload(Submission.answers))
    )
    if submission is None or submission.status != SubmissionStatus.submitted:
        raise HTTPException(status_code=404, detail="제출된 답안이 없습니다.")

    answers_by_question = {answer.question_id: answer for answer in submission.answers}
    is_graded = submission.grading_status == GradingStatus.graded
    answers = []
    for question in sorted(exam.questions, key=lambda item: item.order_index):
        answer = answers_by_question.get(question.id)
        answers.append(
            StudentResultAnswerRead(
                questionId=question.id,
                type=question.type,
                prompt=question.prompt,
                imageUrl=question.image_url,
                points=question.points,
                orderIndex=question.order_index,
                options=question.options,
                answer=answer.answer if answer else None,
                correctAnswer=question.correct_answer if is_graded and question.type != QuestionType.essay else None,
                isCorrect=answer.is_correct if answer and is_graded else None,
                score=float(answer.score) if answer and answer.score is not None and is_graded else None,
                needsManualGrading=bool(answer.needs_manual_grading) if answer and is_graded else False,
                feedback=answer.feedback if answer and is_graded else None,
            )
        )

    return StudentResultRead(
        examId=exam.id,
        title=exam.title,
        studentId=submission.student_id,
        status=submission.status,
        gradingStatus=submission.grading_status,
        totalScore=float(submission.total_score) if submission.total_score is not None and is_graded else None,
        objectiveScore=float(submission.objective_score) if submission.objective_score is not None and is_graded else None,
        manualScore=float(submission.manual_score) if submission.manual_score is not None and is_graded else None,
        maxPoints=sum(question.points for question in exam.questions),
        submittedAt=submission.submitted_at,
        answers=answers,
    )


@router.get("/student/exams/{exam_id}", response_model=StudentExamRead)
def get_student_exam(exam_id: UUID, student_id: str, db: Session = Depends(get_db)) -> Exam:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    validate_exam_open(exam)
    ensure_student_allowed(db, exam.id, student_id)
    existing = db.scalar(select(Submission).where(Submission.exam_id == exam.id, Submission.student_id == student_id))
    if existing and existing.status == SubmissionStatus.submitted:
        raise HTTPException(status_code=409, detail="Exam already submitted")
    return exam


@router.post("/student/exams/{exam_id}/answers", response_model=SubmissionRead)
def save_student_answers(
    exam_id: UUID,
    payload: SaveAnswersRequest,
    db: Session = Depends(get_db),
) -> Submission:
    exam = get_exam_or_404(db, exam_id)
    validate_exam_open(exam)
    ensure_student_allowed(db, exam.id, payload.student_id)
    submission = get_or_create_submission(db, exam, payload.student_id)
    save_answers(db, submission, payload)
    db.commit()
    return load_submission_with_answers(db, submission.id)


@router.post("/student/exams/{exam_id}/submit", response_model=SubmissionRead)
def submit_student_exam(
    exam_id: UUID,
    payload: SubmitExamRequest,
    db: Session = Depends(get_db),
) -> Submission:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    validate_exam_open(exam)
    ensure_student_allowed(db, exam.id, payload.student_id)
    submission = get_or_create_submission(db, exam, payload.student_id)
    save_answers(db, submission, payload)
    submission.status = SubmissionStatus.submitted
    submission.grading_status = GradingStatus.pending
    submission.objective_score = None
    submission.manual_score = None
    submission.total_score = None
    submission.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return load_submission_with_answers(db, submission.id)


@router.post("/exams/{exam_id}/grade", response_model=ExamStatistics)
def grade_exam_submissions(exam_id: UUID, db: Session = Depends(get_db)) -> ExamStatistics:
    exam = get_exam_or_404(db, exam_id, include_questions=True)
    submissions = list(
        db.scalars(
            select(Submission)
            .where(
                Submission.exam_id == exam_id,
                Submission.status == SubmissionStatus.submitted,
                Submission.grading_status == GradingStatus.pending,
            )
            .options(selectinload(Submission.answers))
        ).all()
    )
    questions_by_id = {str(question.id): question for question in exam.questions}
    for submission in submissions:
        apply_grading(submission, list(submission.answers), questions_by_id)
        recalculate_submission_scores(db, submission)
    db.commit()
    return exam_statistics(exam_id, db)


@router.patch("/submission-answers/{answer_id}/score", response_model=SubmissionRead)
def update_submission_answer_score(
    answer_id: UUID,
    payload: ManualAnswerScoreUpdate,
    db: Session = Depends(get_db),
) -> Submission:
    answer = db.scalar(
        select(SubmissionAnswer)
        .where(SubmissionAnswer.id == answer_id)
        .options(selectinload(SubmissionAnswer.submission), selectinload(SubmissionAnswer.question))
    )
    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    if payload.score < 0 or payload.score > answer.question.points:
        raise HTTPException(status_code=400, detail=f"점수는 0점부터 {answer.question.points}점까지 입력할 수 있습니다.")

    answer.score = Decimal(str(payload.score))
    answer.needs_manual_grading = False
    answer.is_correct = True if payload.score == answer.question.points else False if payload.score == 0 else None
    answer.feedback = payload.feedback.strip() if payload.feedback else None
    recalculate_submission_scores(db, answer.submission)
    db.commit()
    return load_submission_with_answers(db, answer.submission.id)


@router.get("/student/submissions/{submission_id}", response_model=SubmissionRead)
def get_student_submission(submission_id: UUID, db: Session = Depends(get_db)) -> Submission:
    return load_submission_with_answers(db, submission_id)
