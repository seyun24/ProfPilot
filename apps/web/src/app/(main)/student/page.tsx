import Link from "next/link";

const examClientBaseUrl = process.env.NEXT_PUBLIC_EXAM_CLIENT_BASE_URL ?? "http://localhost:3100";

export default function StudentPage() {
  return (
    <section className="page-header">
      <div className="eyebrow">학생 화면</div>
      <h1>학생 화면</h1>
      <p className="lead">
        시험 응시와 상담 신청 기능을 사용할 수 있습니다.
      </p>
      <div className="button-row">
        <Link className="button" href={`${examClientBaseUrl}/exam`}>
          시험 입장
        </Link>
        <Link className="button secondary" href="/student/consultations">
          상담 예약
        </Link>
      </div>
    </section>
  );
}
