import type { HealthResponse, UserRole, UserSummary } from "@profpilot/shared";

const API_BASE_URL =
  process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<HealthResponse>("/health"),
  users: () => apiFetch<UserSummary[]>("/api/users"),
  me: (role: UserRole = "professor") =>
    apiFetch<UserSummary>("/api/me", {
      headers: {
        "X-Demo-Role": role,
      },
    }),
};
