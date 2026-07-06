import type {
  ConsultationStatus,
  ExamStatus,
  GradingStatus,
  QuestionType,
  SubmissionStatus,
} from "@profpilot/shared";

export const examStatusLabel: Record<ExamStatus, string> = {
  draft: "작성 중",
  published: "공개됨",
  closed: "마감됨",
};

export const questionTypeLabel: Record<QuestionType, string> = {
  multiple_choice: "객관식",
  ox: "OX",
  short_answer: "단답형",
  essay: "서술형",
};

export const submissionStatusLabel: Record<SubmissionStatus, string> = {
  in_progress: "응시 중",
  submitted: "제출 완료",
};

export const gradingStatusLabel: Record<GradingStatus, string> = {
  pending: "채점 대기",
  graded: "채점 완료",
};

export const consultationStatusLabel: Record<ConsultationStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

// 0=Monday ... 6=Sunday (Python weekday convention)
export const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"] as const;

// Convert a JS Date to Python-style weekday (Monday=0 ... Sunday=6).
export function jsWeekdayToMonday0(jsDay: number): number {
  return (jsDay + 6) % 7;
}
