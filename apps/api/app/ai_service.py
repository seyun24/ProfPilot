"""AI features for ProfPilot.

Hard rules enforced here (see docs/product-brief.md):
- AI must NOT create or write exam questions.
- AI must NOT grade students or assign scores.
- AI only reviews, summarizes, and suggests.

The provider is OpenAI-compatible and configured through environment variables
(OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL). When no API key is set, every
endpoint falls back to a deterministic mock so the platform stays fully usable in
demos and tests without a paid provider.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.config import Settings, get_settings
from app.models import QuestionType
from app.schemas import (
    AIMeta,
    ConsultationSummaryRequest,
    ConsultationSummaryResult,
    ExamReviewRequest,
    ExamReviewResult,
    ProjectReportSummaryRequest,
    ProjectReportSummaryResult,
)

MOCK_PROVIDER = "mock"
OPENAI_PROVIDER = "openai"

SYSTEM_RULES = (
    "You are an assistant inside ProfPilot, a professor workflow platform. "
    "STRICT RULES YOU MUST NEVER BREAK: "
    "(1) You must NOT create, write, or rephrase new exam questions or answers. "
    "(2) You must NOT grade students or assign any score. "
    "(3) You only review, summarize, and suggest. "
    "Respond with ONE valid JSON object using exactly the requested keys. "
    "Do not add any text outside the JSON object."
)


# --------------------------------------------------------------------------- #
# OpenAI-compatible client
# --------------------------------------------------------------------------- #


def _chat_json(settings: Settings, user_prompt: str) -> dict[str, Any]:
    """Call the OpenAI-compatible chat completions API and parse a JSON object."""
    from openai import OpenAI  # imported lazily so mock mode needs no dependency

    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        timeout=settings.openai_timeout_seconds,
    )
    response = client.chat.completions.create(
        model=settings.openai_model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_RULES},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def _meta(settings: Settings, mocked: bool) -> AIMeta:
    return AIMeta(
        provider=MOCK_PROVIDER if mocked else OPENAI_PROVIDER,
        model=settings.openai_model,
        mocked=mocked,
    )


# --------------------------------------------------------------------------- #
# Small deterministic text helpers used by the mock generators
# --------------------------------------------------------------------------- #

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?。？！])\s+|\n+")
_VAGUE_TERMS = (
    "적절한",
    "올바른",
    "가장",
    "모두",
    "항상",
    "절대",
    "때때로",
    "appropriate",
    "correct",
    "best",
    "always",
    "never",
    "all of the above",
    "none of the above",
)
_ACTION_HINTS = (
    "해야",
    "제출",
    "준비",
    "확인",
    "다음",
    "보완",
    "수정",
    "작성",
    "todo",
    "action",
    "follow up",
    "follow-up",
)
_RISK_HINTS = (
    "지연",
    "늦",
    "블로커",
    "막힘",
    "문제",
    "못 ",
    "안 ",
    "실패",
    "risk",
    "delay",
    "blocker",
    "issue",
    "stuck",
    "behind",
)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]


def _lines(text: str) -> list[str]:
    parts: list[str] = []
    for line in text.splitlines():
        line = line.strip(" \t-•*")
        parts.extend(s for s in _sentences(line) if s)
    return parts


def _matching(fragments: list[str], hints: tuple[str, ...]) -> list[str]:
    out: list[str] = []
    for fragment in fragments:
        lowered = fragment.lower()
        if any(hint in lowered for hint in hints) and fragment not in out:
            out.append(fragment)
    return out


# --------------------------------------------------------------------------- #
# 1. Exam question review
# --------------------------------------------------------------------------- #


def _mock_exam_review(req: ExamReviewRequest) -> ExamReviewResult:
    text = req.question_text
    lowered = text.lower()
    choices = req.choices or []

    typo_issues: list[str] = []
    if "  " in text:
        typo_issues.append("연속된 공백이 있습니다.")
    if re.search(r"[.,!?]{2,}", text):
        typo_issues.append("문장 부호가 중복되어 있습니다.")
    if text != text.strip():
        typo_issues.append("앞뒤 불필요한 공백이 있습니다.")

    grammar_issues: list[str] = []
    if req.question_type in (QuestionType.multiple_choice, QuestionType.ox) and not re.search(
        r"[?？.]\s*$", text
    ):
        grammar_issues.append("질문이 마침표나 물음표로 끝나지 않습니다.")

    ambiguous_expressions = [term for term in _VAGUE_TERMS if term in lowered]

    normalized = [c.strip().lower() for c in choices]
    duplicate_choices = sorted(
        {choices[i].strip() for i in range(len(normalized)) if normalized.count(normalized[i]) > 1}
    )

    answer_conflict: str | None = None
    if req.question_type == QuestionType.ox and choices:
        allowed = {"o", "x", "참", "거짓", "true", "false"}
        if any(c not in allowed for c in normalized):
            answer_conflict = "OX 문항인데 선택지가 O/X 형식이 아닙니다."
    if req.question_type == QuestionType.multiple_choice and req.correct_answer is not None and choices:
        answer_str = str(req.correct_answer).strip().lower()
        indexed = answer_str.isdigit() and 0 <= int(answer_str) < len(choices)
        if answer_str not in normalized and not indexed:
            answer_conflict = "제시된 정답이 선택지 목록에 존재하지 않습니다."

    # Difficulty is an OPINION only — never a grade.
    word_count = len(text.split())
    if word_count > 40 or len(choices) >= 5:
        difficulty_opinion = "다소 어려움: 지문이 길거나 선택지가 많습니다."
    elif word_count < 8:
        difficulty_opinion = "쉬움: 지문이 짧고 단순합니다."
    else:
        difficulty_opinion = "보통 수준으로 보입니다."

    base_time = {
        QuestionType.ox: 20,
        QuestionType.multiple_choice: 45,
        QuestionType.short_answer: 60,
        QuestionType.essay: 300,
    }[req.question_type]
    estimated = base_time + 3 * word_count + 5 * len(choices)

    warnings = list(typo_issues) + list(grammar_issues)
    if ambiguous_expressions:
        warnings.append("모호할 수 있는 표현을 검토하세요: " + ", ".join(ambiguous_expressions))
    if duplicate_choices:
        warnings.append("중복된 선택지를 정리하세요: " + ", ".join(duplicate_choices))
    if answer_conflict:
        warnings.append(answer_conflict)

    return ExamReviewResult(
        typo_issues=typo_issues,
        grammar_issues=grammar_issues,
        ambiguous_expressions=ambiguous_expressions,
        duplicate_choices=duplicate_choices,
        answer_conflict=answer_conflict,
        difficulty_opinion=difficulty_opinion,
        estimated_solving_time_seconds=estimated,
        suggested_warnings=warnings,
    )


def review_exam_question(
    req: ExamReviewRequest, settings: Settings | None = None
) -> tuple[ExamReviewResult, AIMeta]:
    settings = settings or get_settings()
    if not settings.ai_enabled:
        return _mock_exam_review(req), _meta(settings, mocked=True)

    prompt = (
        "Review this exam question for quality. DO NOT rewrite the question or invent answers.\n"
        "Return JSON with keys: typo_issues (list of strings), grammar_issues (list), "
        "ambiguous_expressions (list), duplicate_choices (list), answer_conflict (string or null), "
        "difficulty_opinion (string, an opinion only), estimated_solving_time_seconds (integer), "
        "suggested_warnings (list of strings).\n\n"
        f"question_type: {req.question_type.value}\n"
        f"question_text: {req.question_text}\n"
        f"choices: {json.dumps(req.choices, ensure_ascii=False)}\n"
        f"professor_correct_answer: {json.dumps(req.correct_answer, ensure_ascii=False)}\n"
    )
    try:
        data = _chat_json(settings, prompt)
        return ExamReviewResult.model_validate(data), _meta(settings, mocked=False)
    except Exception:
        return _mock_exam_review(req), _meta(settings, mocked=True)


# --------------------------------------------------------------------------- #
# 2. Consultation note summary
# --------------------------------------------------------------------------- #


def _mock_consultation_summary(req: ConsultationSummaryRequest) -> ConsultationSummaryResult:
    sentences = _sentences(req.note)
    summary = " ".join(sentences[:2]) if sentences else req.note.strip()

    action_items = _matching(_lines(req.note), _ACTION_HINTS)
    next_meeting = (
        "약 2주 후 후속 상담을 잡아 진행 상황을 확인하는 것을 권장합니다."
        if action_items
        else "특별한 후속 조치가 없으면 필요 시 추가 상담을 권장합니다."
    )

    return ConsultationSummaryResult(
        summary=summary,
        action_items=action_items,
        next_meeting_recommendation=next_meeting,
    )


def summarize_consultation(
    req: ConsultationSummaryRequest, settings: Settings | None = None
) -> tuple[ConsultationSummaryResult, AIMeta]:
    settings = settings or get_settings()
    if not settings.ai_enabled:
        return _mock_consultation_summary(req), _meta(settings, mocked=True)

    prompt = (
        "Summarize this professor consultation note. Only summarize and suggest.\n"
        "Return JSON with keys: summary (string), action_items (list of strings), "
        "next_meeting_recommendation (string).\n\n"
        f"note: {req.note}\n"
    )
    try:
        data = _chat_json(settings, prompt)
        return ConsultationSummaryResult.model_validate(data), _meta(settings, mocked=False)
    except Exception:
        return _mock_consultation_summary(req), _meta(settings, mocked=True)


# --------------------------------------------------------------------------- #
# 3. Graduation project weekly report summary
# --------------------------------------------------------------------------- #


def _mock_project_report_summary(req: ProjectReportSummaryRequest) -> ProjectReportSummaryResult:
    sentences = _sentences(req.report)
    summary = " ".join(sentences[:2]) if sentences else req.report.strip()

    percent = re.search(r"(\d{1,3})\s*%", req.report)
    if percent:
        progress = f"보고서에 명시된 진척도: {percent.group(1)}%"
    else:
        progress = "진척도 수치가 명시되지 않아 서술 내용 기준으로만 판단 가능합니다."

    risks = _matching(_lines(req.report), _RISK_HINTS)

    feedback = (
        "이번 주 보고 내용을 확인했습니다. "
        + (f"{progress} " if percent else "")
        + (
            "언급된 리스크에 대한 대응 계획을 다음 보고에 포함해 주세요."
            if risks
            else "현재 진행 흐름이 무난해 보이며, 다음 목표를 구체화해 주세요."
        )
    )

    return ProjectReportSummaryResult(
        summary=summary,
        progress=progress,
        risks=risks,
        professor_feedback_draft=feedback,
    )


def summarize_project_report(
    req: ProjectReportSummaryRequest, settings: Settings | None = None
) -> tuple[ProjectReportSummaryResult, AIMeta]:
    settings = settings or get_settings()
    if not settings.ai_enabled:
        return _mock_project_report_summary(req), _meta(settings, mocked=True)

    prompt = (
        "Summarize this graduation project weekly report and draft professor feedback. "
        "Do not grade the students.\n"
        "Return JSON with keys: summary (string), progress (string), risks (list of strings), "
        "professor_feedback_draft (string).\n\n"
        f"report: {req.report}\n"
    )
    try:
        data = _chat_json(settings, prompt)
        return ProjectReportSummaryResult.model_validate(data), _meta(settings, mocked=False)
    except Exception:
        return _mock_project_report_summary(req), _meta(settings, mocked=True)
