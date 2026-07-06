import Link from "next/link";

export default function ProfessorPage() {
  return (
    <section className="page-header">
      <div className="eyebrow">교수 화면</div>
      <h1>교수 업무 화면이 준비되었습니다.</h1>
      <p className="lead">
        시험 생성, 상담 승인, 졸업 프로젝트 관리를 이 기반 화면 위에서 확장합니다.
      </p>
      <div className="button-row">
        <Link className="button" href="/professor/exams">
          시험 관리
        </Link>
      </div>
    </section>
  );
}
