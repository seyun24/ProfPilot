import { api } from "@/lib/api";

export default async function StudentPage() {
  const me = await api.me("student").catch(() => null);

  return (
    <section className="page-header">
      <div className="eyebrow">Student entry</div>
      <h1>{me ? `Student workspace for ${me.name}.` : "Student workspace"}</h1>
      <p className="lead">
        Student exam entry, consultation requests, and weekly project reports will be built as
        separate modules. This page only proves the student role path exists.
      </p>
    </section>
  );
}
