import type React from "react";

import AuthShell from "@/components/AuthShell";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthShell>{children}</AuthShell>;
}
