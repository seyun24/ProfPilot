import type { Metadata } from "next";
import type React from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "ProfPilot",
  description: "교수 업무를 돕는 AI 기반 워크플로우 플랫폼",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('profpilot-theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
