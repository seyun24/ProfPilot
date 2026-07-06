"use client";

import type { ExamStatistics } from "@profpilot/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { questionTypeLabel } from "@/lib/labels";

export default function ExamResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const [stats, setStats] = useState<ExamStatistics | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isGrading, setIsGrading] = useState(false);

  async function refresh() {
    const data = await api.statistics(examId);
    setStats(data);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, [examId]);

  async function gradeAll() {
    setIsGrading(true);
    setMessage("");
    setError("");
    try {
      const data = await api.gradeExam(examId);
      setStats(data);
      setMessage("제출 답안 일괄채점이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄채점에 실패했습니다.");
    } finally {
      setIsGrading(false);
    }
  }

  if (!stats) return <p className="muted">통계를 불러오는 중...</p>;

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">결과</div>
        <h1>교수 결과 확인 및 시험 통계</h1>
        <p className="lead">학생 제출 답안은 저장 상태로 보관되며, 교수 일괄채점 버튼을 눌렀을 때 채점됩니다.</p>
        <div className="button-row">
          <button className="button" disabled={isGrading || stats.pendingGrading === 0} type="button" onClick={gradeAll}>
            {isGrading ? "채점 중..." : "일괄채점"}
          </button>
        </div>
      </section>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <div className="panel">
          <h2>제출</h2>
          <p>제출 {stats.submitted}건 / 전체 {stats.submissions}건</p>
        </div>
        <div className="panel">
          <h2>채점 상태</h2>
          <p>완료 {stats.graded}건 / 대기 {stats.pendingGrading}건</p>
        </div>
        <div className="panel">
          <h2>서버 채점 평균</h2>
          <p>{stats.averageObjectiveScore.toFixed(1)} / {stats.maxPoints}</p>
        </div>
        <div className="panel">
          <h2>수동 채점 대기</h2>
          <p>{stats.pendingManualGrading}</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>문항별 통계</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>문항</th>
                <th>유형</th>
                <th>응답 수</th>
                <th>정답 수</th>
                <th>수동 채점 대기</th>
              </tr>
            </thead>
            <tbody>
              {stats.questionStats.map((item) => (
                <tr key={String(item.questionId)}>
                  <td>{String(item.prompt)}</td>
                  <td>{questionTypeLabel[String(item.type) as keyof typeof questionTypeLabel] ?? String(item.type)}</td>
                  <td>{String(item.answered)}</td>
                  <td>{String(item.correct)}</td>
                  <td>{String(item.manualPending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
