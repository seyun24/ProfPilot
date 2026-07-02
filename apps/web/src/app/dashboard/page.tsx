import { api } from "@/lib/api";

export default async function DashboardPage() {
  const [me, users] = await Promise.all([
    api.me("professor").catch(() => null),
    api.users().catch(() => []),
  ]);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">Professor dashboard</div>
        <h1>{me ? `Welcome, ${me.name}.` : "Professor dashboard"}</h1>
        <p className="lead">
          This page establishes the dashboard shell for exams needing review, consultations,
          graduation project risk teams, and AI task summaries.
        </p>
      </section>

      <section className="grid" aria-label="Dashboard placeholders">
        <div className="panel">
          <h2>Exams needing review</h2>
          <p>Exam module placeholder. Future work can mount review queues here.</p>
        </div>
        <div className="panel">
          <h2>Today's consultations</h2>
          <p>Consultation module placeholder. Approved meetings can appear here.</p>
        </div>
        <div className="panel">
          <h2>Risk teams</h2>
          <p>Graduation project placeholder. Risk rules will summarize teams here.</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Seeded users</h2>
        <ul className="status-list">
          {users.map((user) => (
            <li key={user.id}>
              {user.name} - {user.role}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
