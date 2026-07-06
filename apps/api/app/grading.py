from decimal import Decimal
from typing import Any

from app.models import Question, QuestionType, Submission, SubmissionAnswer, SubmissionStatus


def normalize_answer(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().casefold()


def keyword_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = str(value).replace("\n", ",").split(",")
    keywords = []
    for item in raw_items:
        for part in str(item).split():
            clean = normalize_answer(part)
            if clean:
                keywords.append(clean)
    return keywords


def keyword_score(question: Question, answer: Any) -> tuple[bool | None, float | None, bool]:
    keywords = keyword_list(question.correct_answer)
    if not keywords:
        return None, None, True

    normalized_answer = normalize_answer(answer)
    matched = sum(1 for keyword in keywords if keyword in normalized_answer)
    score = round(float(question.points) * (matched / len(keywords)), 2)
    return matched == len(keywords), score, False


def grade_answer(question: Question, answer: Any) -> tuple[bool | None, float | None, bool]:
    correct = question.correct_answer
    if question.type in (QuestionType.multiple_choice, QuestionType.ox):
        is_correct = normalize_answer(answer) == normalize_answer(correct)
        return is_correct, float(question.points) if is_correct else 0.0, False

    if question.type in (QuestionType.short_answer, QuestionType.essay):
        return keyword_score(question, answer)

    return None, None, True


def apply_grading(
    submission: Submission,
    answers: list[SubmissionAnswer],
    questions_by_id: dict[str, Question],
) -> None:
    objective_score = 0.0
    manual_score = 0.0
    has_manual = False

    for answer in answers:
        question = questions_by_id.get(str(answer.question_id))
        if question is None:
            continue
        is_correct, score, needs_manual = grade_answer(question, answer.answer)
        answer.is_correct = is_correct
        answer.score = Decimal(str(score)) if score is not None else None
        answer.needs_manual_grading = needs_manual
        if needs_manual:
            has_manual = True
        elif score is not None:
            objective_score += score

    submission.objective_score = Decimal(str(objective_score))
    submission.manual_score = None if has_manual else Decimal(str(manual_score))
    submission.total_score = Decimal(str(objective_score + manual_score)) if not has_manual else Decimal(str(objective_score))
    submission.status = SubmissionStatus.submitted
