"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "profpilot-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // The inline script in the root layout already set data-theme before paint;
    // read it back so the button starts in sync (no flash, no mismatch).
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }

  return (
    <button
      type="button"
      className="button secondary compact theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={theme === "dark" ? "라이트 모드" : "다크 모드"}
    >
      {/* Avoid hydration mismatch: render a stable label until mounted */}
      {mounted ? (theme === "dark" ? "☀️ 라이트" : "🌙 다크") : "🌙 다크"}
    </button>
  );
}
