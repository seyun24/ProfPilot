"use client";

import type { UserSummary } from "@profpilot/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import ThemeToggle from "@/components/ThemeToggle";

const examClientBaseUrl = process.env.NEXT_PUBLIC_EXAM_CLIENT_BASE_URL ?? "http://localhost:3100";
const AUTH_STORAGE_KEY = "profpilot:user";

const publicPaths = new Set(["/", "/login"]);

function readUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSummary;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveAuthUser(user: UserSummary) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export default function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const currentUser = readUser();
    setUser(currentUser);
    setIsReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!isReady) return;
    if (publicPaths.has(pathname)) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (pathname.startsWith("/professor") && user.role !== "professor") {
      router.replace("/student");
      return;
    }
    if (pathname.startsWith("/student") && user.role !== "student") {
      router.replace("/professor");
    }
  }, [isReady, pathname, router, user]);

  const navItems = useMemo(() => {
    if (!user) {
      return [
        { href: "/login", label: "로그인" },
      ];
    }
    if (user.role === "professor") {
      return [
        { href: "/dashboard", label: "대시보드" },
        { href: "/professor/exams", label: "교수 시험 관리" },
        { href: "/professor/consultations", label: "상담 캘린더" },
      ];
    }
    return [
      { href: "/student/consultations", label: "상담 예약" },
    ];
  }, [user]);

  function logout() {
    clearAuthUser();
    setUser(null);
    router.replace("/login");
  }

  const blockedProfessor = pathname.startsWith("/professor") && user?.role !== "professor";
  const blockedStudent = pathname.startsWith("/student") && user?.role !== "student";
  const shouldHideContent = !isReady || (!publicPaths.has(pathname) && (!user || blockedProfessor || blockedStudent));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">ProfPilot</div>
          <div className="brand-subtitle">교수 업무 관리 플랫폼</div>
        </div>
        <nav className="nav" aria-label="주요 메뉴">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          {user?.role === "professor" ? <a href={`${examClientBaseUrl}/exam`}>시험 클라이언트</a> : null}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">ProfPilot 통합 관리 화면</div>
          <div className="topbar-actions">
            <div className="role-pill">{user ? `${user.name} / ${user.role === "professor" ? "교수" : "학생"}` : "로그인 필요"}</div>
            <ThemeToggle />
            {user ? (
              <button className="button secondary compact" type="button" onClick={logout}>
                로그아웃
              </button>
            ) : null}
          </div>
        </header>
        <div className="content">{shouldHideContent ? <p className="muted">권한을 확인하는 중입니다...</p> : children}</div>
      </main>
    </div>
  );
}
