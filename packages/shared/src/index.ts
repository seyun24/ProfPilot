export const USER_ROLES = ["professor", "student"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type UserSummary = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string | null;
};

export type HealthResponse = {
  status: "ok";
  service: string;
};

export type ExamStatus = "draft" | "published" | "closed";
export type QuestionType = "multiple_choice" | "ox" | "short_answer" | "essay";
export type SubmissionStatus = "in_progress" | "submitted";
export type GradingStatus = "pending" | "graded";

export type Question = {
  id: string;
  examId: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  points: number;
  orderIndex: number;
  options?: string[] | null;
  correctAnswer?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StudentQuestion = Omit<Question, "examId" | "correctAnswer" | "createdAt" | "updatedAt">;

export type Exam = {
  id: string;
  title: string;
  description: string;
  status: ExamStatus;
  examCode?: string | null;
  durationMinutes?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
};

export type StudentExam = {
  id: string;
  title: string;
  description: string;
  examCode?: string | null;
  durationMinutes?: number | null;
  questions: StudentQuestion[];
};

export type AllowedStudent = {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string | null;
  createdAt: string;
};

export type SubmissionAnswer = {
  id: string;
  questionId: string;
  answer: unknown;
  isCorrect?: boolean | null;
  score?: number | null;
  needsManualGrading: boolean;
  feedback?: string | null;
};

export type Submission = {
  id: string;
  examId: string;
  studentId: string;
  status: SubmissionStatus;
  gradingStatus: GradingStatus;
  totalScore?: number | null;
  objectiveScore?: number | null;
  manualScore?: number | null;
  submittedAt?: string | null;
  answers: SubmissionAnswer[];
};

export type ExamStatistics = {
  examId: string;
  submissions: number;
  submitted: number;
  graded: number;
  pendingGrading: number;
  pendingManualGrading: number;
  averageObjectiveScore: number;
  maxPoints: number;
  questionStats: Array<Record<string, unknown>>;
};

export const CONSULTATION_DAY_START_HOUR = 9;
export const CONSULTATION_DAY_END_HOUR = 22;

export type ConsultationStatus = "pending" | "approved" | "rejected";

export type Consultation = {
  id: string;
  studentId: string;
  studentName?: string | null;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  reason: string;
  status: ConsultationStatus;
  createdAt: string;
};

export type AvailabilityRule = {
  id?: string;
  weekday: number; // 0=Monday ... 6=Sunday
  startHour: number;
  endHour: number;
};

export type ConsultationBlock = {
  id: string;
  date: string; // YYYY-MM-DD
  startHour: number | null;
  endHour: number | null;
  reason?: string | null;
  createdAt: string;
};

// available | unavailable | blocked | pending | approved | past
export type ConsultationSlotState =
  | "available"
  | "unavailable"
  | "blocked"
  | "pending"
  | "approved"
  | "past";

export type ConsultationSlot = {
  hour: number;
  state: ConsultationSlotState;
  reason?: string | null;
  studentId?: string | null;
};

export type DaySlots = {
  date: string;
  weekday: number;
  workingDay: boolean;
  slots: ConsultationSlot[];
};
