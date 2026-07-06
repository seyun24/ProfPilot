import Link from "next/link";

export default async function HomePage() {
  return (
    <>
      <section className="page-header">
        <div className="eyebrow">ProfPilot</div>
        <h1>시험 관리와 상담 예약을 한 곳에서 처리합니다.</h1>
        <p className="lead">교수는 시험을 만들고 채점하며, 학생은 허용된 시험에 응시하고 결과를 확인할 수 있습니다.</p>
        <div className="button-row">
          <Link className="button" href="/login">
            로그인
          </Link>
        </div>
      </section>

      <section className="grid" aria-label="주요 기능">
        <div className="panel">
          <h2>시험 출제</h2>
          <p>문항 작성, 제한시간 설정, 공개 상태 관리, 응시 대상 학생 등록을 지원합니다.</p>
        </div>
        <div className="panel">
          <h2>학생 응시</h2>
          <p>학생은 학번과 시험 코드로 시험에 입장하고 제한시간 안에 답안을 제출합니다.</p>
        </div>
        <div className="panel">
          <h2>채점 관리</h2>
          <p>제출 답안을 모아 확인하고 자동채점, 부분점수, 비고 입력, 일괄채점을 처리합니다.</p>
        </div>
        <div className="panel">
          <h2>결과 조회</h2>
          <p>학생은 시험 코드와 학번으로 채점 결과와 문항별 피드백을 확인합니다.</p>
        </div>
        <div className="panel">
          <h2>상담 예약</h2>
          <p>학생 상담 신청과 교수의 승인, 거절, 일정 관리를 지원합니다.</p>
        </div>
      </section>
    </>
  );
}
