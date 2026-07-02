import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="page-header">
      <div className="eyebrow">Demo access</div>
      <h1>Choose a seeded role.</h1>
      <p className="lead">
        Real authentication is outside the foundation scope. The current base supports role-aware API
        calls using seeded professor and student users.
      </p>
      <div className="button-row">
        <Link className="button" href="/dashboard">
          Continue as professor
        </Link>
        <Link className="button secondary" href="/student">
          Continue as student
        </Link>
      </div>
    </section>
  );
}
