import { api } from "@/lib/api";

const roleLabel = {
  professor: "교수",
  student: "학생",
} as const;

export default async function DashboardPage() {
  const [me, users] = await Promise.all([
    api.me("professor").catch(() => null),
    api.users().catch(() => []),
  ]);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">교수 대시보드</div>
        <h1>{me ? `${me.name}님, 환영합니다.` : "교수 대시보드"}</h1>
        <p className="lead">
          검토가 필요한 시험, 오늘의 상담, 위험 졸업 프로젝트 팀, 오늘의 작업 요약을 모아보는 화면입니다.
        </p>
      </section>

      <section className="grid" aria-label="대시보드 요약">
        <div className="panel">
          <h2>검토 필요 시험</h2>
          <p>교수가 확인해야 할 시험과 제출 현황이 표시됩니다.</p>
        </div>
        <div className="panel">
          <h2>오늘의 상담</h2>
          <p>승인된 상담 일정이 이후 이 영역에 표시됩니다.</p>
        </div>
        <div className="panel">
          <h2>위험 팀</h2>
          <p>졸업 프로젝트 위험 팀 요약이 이후 이 영역에 표시됩니다.</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>기본 사용자</h2>
        <ul className="status-list">
          {users.map((user) => (
            <li key={user.id}>
              {user.name} - {roleLabel[user.role]}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
