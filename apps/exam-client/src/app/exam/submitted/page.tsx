"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SubmittedContent() {
  const submissionId = useSearchParams().get("submissionId");

  return (
    <main className="exam-standalone">
      <section className="exam-login-screen">
        <div className="exam-login-card">
          <div className="eyebrow">제출 완료</div>
          <h1>답안이 전송되었습니다.</h1>
          <p className="lead">제출 답안은 ProfPilot 서버에 저장되며, 교수 일괄채점 전까지 채점되지 않습니다.</p>
          {submissionId ? <p className="muted">제출 ID: {submissionId}</p> : null}
          <div className="button-row">
            <Link className="button secondary" href="/exam">
              입장 화면으로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ExamSubmittedPage() {
  return (
    <Suspense fallback={<p className="muted">제출 정보를 불러오는 중...</p>}>
      <SubmittedContent />
    </Suspense>
  );
}
