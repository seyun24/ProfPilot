import type {
  AllowedStudent,
  AvailabilityRule,
  Consultation,
  ConsultationBlock,
  ConsultationStatus,
  DaySlots,
  Exam,
  ExamStatistics,
  HealthResponse,
  Question,
  QuestionType,
  StudentExam,
  Submission,
  UserRole,
  UserSummary,
} from "@profpilot/shared";

const API_BASE_URL =
  process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
      if (error.detail) message = error.detail;
    } catch {
      // Keep the generic HTTP error when the response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function apiFormFetch<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status} ${response.statusText}`;
    try {
      const error = (await response.json()) as { detail?: string };
      if (error.detail) message = error.detail;
    } catch {
      // Keep the generic HTTP error when the response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<HealthResponse>("/health"),
  users: () => apiFetch<UserSummary[]>("/api/users"),
  login: (payload: { username: string; password: string }) =>
    apiFetch<{ user: UserSummary }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: (role: UserRole = "professor") =>
    apiFetch<UserSummary>("/api/me", {
      headers: {
        "X-Demo-Role": role,
      },
    }),
  exams: () => apiFetch<Exam[]>("/api/exams"),
  exam: (examId: string) => apiFetch<Exam>(`/api/exams/${examId}`),
  createExam: (payload: { title: string; description?: string; durationMinutes?: number | null }) =>
    apiFetch<Exam>("/api/exams", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateExam: (examId: string, payload: { title?: string; description?: string; durationMinutes?: number | null }) =>
    apiFetch<Exam>(`/api/exams/${examId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  publishExam: (examId: string) =>
    apiFetch<Exam>(`/api/exams/${examId}/publish`, {
      method: "POST",
    }),
  closeExam: (examId: string) =>
    apiFetch<Exam>(`/api/exams/${examId}/close`, {
      method: "POST",
    }),
  createQuestion: (
    examId: string,
    payload: {
      type: QuestionType;
      prompt: string;
      points: number;
      orderIndex: number;
      options?: string[] | null;
      correctAnswer?: unknown;
    },
  ) =>
    apiFetch<Question>(`/api/exams/${examId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestion: (
    questionId: string,
    payload: Partial<{
      type: QuestionType;
      prompt: string;
      points: number;
      orderIndex: number;
      options: string[] | null;
      correctAnswer: unknown;
    }>,
  ) =>
    apiFetch<Question>(`/api/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  uploadQuestionImage: (questionId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiFormFetch<Question>(`/api/questions/${questionId}/image`, body);
  },
  addAllowedStudents: (examId: string, students: Array<{ studentId: string; studentName?: string }>) =>
    apiFetch<AllowedStudent[]>(`/api/exams/${examId}/allowed-students/bulk`, {
      method: "POST",
      body: JSON.stringify({ students }),
    }),
  allowedStudents: (examId: string) =>
    apiFetch<AllowedStudent[]>(`/api/exams/${examId}/allowed-students`),
  updateAllowedStudent: (
    examId: string,
    allowedStudentId: string,
    payload: { studentId?: string; studentName?: string | null },
  ) =>
    apiFetch<AllowedStudent>(`/api/exams/${examId}/allowed-students/${allowedStudentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAllowedStudent: (examId: string, allowedStudentId: string) =>
    apiFetch<{ status: string }>(`/api/exams/${examId}/allowed-students/${allowedStudentId}`, {
      method: "DELETE",
    }),
  updateAnswerScore: (answerId: string, score: number, feedback?: string | null) =>
    apiFetch<Submission>(`/api/submission-answers/${answerId}/score`, {
      method: "PATCH",
      body: JSON.stringify({ score, feedback }),
    }),
  submissions: (examId: string) => apiFetch<Submission[]>(`/api/exams/${examId}/submissions`),
  statistics: (examId: string) => apiFetch<ExamStatistics>(`/api/exams/${examId}/statistics`),
  gradeExam: (examId: string) =>
    apiFetch<ExamStatistics>(`/api/exams/${examId}/grade`, {
      method: "POST",
    }),
  validateStudentExam: (payload: { studentId: string; examCode: string }) =>
    apiFetch<{ examId: string; submissionId: string; title: string }>("/api/student/exams/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  studentExam: (examId: string, studentId: string) =>
    apiFetch<StudentExam>(`/api/student/exams/${examId}?student_id=${encodeURIComponent(studentId)}`),
  saveAnswers: (examId: string, payload: { studentId: string; answers: Array<{ questionId: string; answer: unknown }> }) =>
    apiFetch<Submission>(`/api/student/exams/${examId}/answers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitExam: (examId: string, payload: { studentId: string; answers: Array<{ questionId: string; answer: unknown }> }) =>
    apiFetch<Submission>(`/api/student/exams/${examId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // --- Consultations ---
  consultations: (params?: { from?: string; to?: string; status?: ConsultationStatus; studentId?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.status) query.set("status", params.status);
    if (params?.studentId) query.set("studentId", params.studentId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<Consultation[]>(`/api/consultations${suffix}`);
  },
  daySlots: (date: string) => apiFetch<DaySlots>(`/api/consultations/slots?date=${date}`),
  createConsultation: (payload: {
    studentId: string;
    studentName?: string;
    date: string;
    startHour: number;
    reason?: string;
  }) =>
    apiFetch<Consultation>("/api/consultations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approveConsultation: (consultationId: string) =>
    apiFetch<Consultation>(`/api/consultations/${consultationId}/approve`, { method: "POST" }),
  rejectConsultation: (consultationId: string) =>
    apiFetch<Consultation>(`/api/consultations/${consultationId}/reject`, { method: "POST" }),
  deleteConsultation: (consultationId: string) =>
    apiFetch<{ status: string }>(`/api/consultations/${consultationId}`, { method: "DELETE" }),

  availabilityRules: () => apiFetch<AvailabilityRule[]>("/api/consultations/availability"),
  saveAvailabilityRules: (rules: Array<{ weekday: number; startHour: number; endHour: number }>) =>
    apiFetch<AvailabilityRule[]>("/api/consultations/availability", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),
  consultationBlocks: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<ConsultationBlock[]>(`/api/consultations/blocks${suffix}`);
  },
  createConsultationBlock: (payload: {
    date: string;
    startHour?: number | null;
    endHour?: number | null;
    reason?: string;
  }) =>
    apiFetch<ConsultationBlock>("/api/consultations/blocks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteConsultationBlock: (blockId: string) =>
    apiFetch<{ status: string }>(`/api/consultations/blocks/${blockId}`, { method: "DELETE" }),
};
