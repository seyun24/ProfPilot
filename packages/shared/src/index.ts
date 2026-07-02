export const USER_ROLES = ["professor", "student"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string | null;
};

export type HealthResponse = {
  status: "ok";
  service: string;
};
