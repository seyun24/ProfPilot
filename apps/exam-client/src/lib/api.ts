import type { HealthResponse, StudentExam, Submission } from "@profpilot/shared";

export type StudentResultAnswer = {
  questionId: string;
  type: "multiple_choice" | "ox" | "short_answer" | "essay";
  prompt: string;
  imageUrl?: string | null;
  points: number;
  orderIndex: number;
  options?: string[] | null;
  answer: unknown;
  correctAnswer?: unknown;
  isCorrect?: boolean | null;
  score?: number | null;
  needsManualGrading: boolean;
  feedback?: string | null;
};

export type StudentResult = {
  examId: string;
  title: string;
  studentId: string;
  status: "in_progress" | "submitted";
  gradingStatus: "pending" | "graded";
  totalScore?: number | null;
  objectiveScore?: number | null;
  manualScore?: number | null;
  maxPoints: number;
  submittedAt?: string | null;
  answers: StudentResultAnswer[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status} ${response.statusText}`;
    try {
      const error = (await response.json()) as { detail?: string };
      if (error.detail) {
        message = error.detail;
      }
    } catch {
      // Keep the generic HTTP error when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const PUBLIC_API_BASE_URL = API_BASE_URL;

export const api = {
  health: () => apiFetch<HealthResponse>("/health"),
  validateStudentExam: (payload: { studentId: string; examCode: string }) =>
    apiFetch<{ examId: string; submissionId: string; title: string }>("/api/student/exams/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  studentExam: (examId: string, studentId: string) =>
    apiFetch<StudentExam>(`/api/student/exams/${examId}?student_id=${encodeURIComponent(studentId)}`),
  saveAnswers: (
    examId: string,
    payload: { studentId: string; answers: Array<{ questionId: string; answer: unknown }> },
  ) =>
    apiFetch<Submission>(`/api/student/exams/${examId}/answers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitExam: (
    examId: string,
    payload: { studentId: string; answers: Array<{ questionId: string; answer: unknown }> },
  ) =>
    apiFetch<Submission>(`/api/student/exams/${examId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  studentResult: (payload: { studentId: string; examCode: string }) =>
    apiFetch<StudentResult>("/api/student/results", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
