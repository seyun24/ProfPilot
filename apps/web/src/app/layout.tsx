import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "ProfPilot",
  description: "AI-assisted professor workflow platform",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/professor", label: "Professor" },
  { href: "/student", label: "Student" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-title">ProfPilot</div>
              <div className="brand-subtitle">Professor workflow foundation</div>
            </div>
            <nav className="nav" aria-label="Primary navigation">
              {navItems.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="main">
            <header className="topbar">
              <div className="topbar-title">Shared Platform Shell</div>
              <div className="role-pill">professor / student ready</div>
            </header>
            <div className="content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
