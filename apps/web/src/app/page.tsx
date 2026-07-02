import Link from "next/link";

import { api } from "@/lib/api";

export default async function HomePage() {
  const health = await api.health().catch(() => null);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">Foundation</div>
        <h1>AI-assisted workflows for professors, built on a shared platform base.</h1>
        <p className="lead">
          This foundation wires the frontend, backend, database, roles, API client, and seed data.
          Feature modules can now build on top without redefining the platform structure.
        </p>
        <div className="button-row">
          <Link className="button" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="button secondary" href="/login">
            Demo login
          </Link>
        </div>
      </section>

      <section className="grid" aria-label="Foundation status">
        <div className="panel">
          <h2>API</h2>
          <p>{health ? `${health.service} is reachable.` : "API is not reachable yet."}</p>
        </div>
        <div className="panel">
          <h2>Roles</h2>
          <p>Professor and student roles are defined across the shared package and API.</p>
        </div>
        <div className="panel">
          <h2>Modules</h2>
          <p>Exam, consultation, and graduation project modules are intentionally placeholders.</p>
        </div>
      </section>
    </>
  );
}
