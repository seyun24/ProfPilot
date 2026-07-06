"use client";

import { FormEvent, useState } from "react";

import { api, PUBLIC_API_BASE_URL, StudentResult } from "@/lib/api";

function assetUrl(path: string | null | undefined) {
  const cleanPath = path?.trim();
  if (!cleanPath) return "";
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${PUBLIC_API_BASE_URL}${cleanPath}`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function answerStatus(isCorrect: boolean | null | undefined, needsManualGrading: boolean) {
  if (needsManualGrading) return "수동 채점 필요";
  if (isCorrect === true) return "정답";
  if (isCorrect === false) return "오답";
  return "채점 대기";
}

export default function StudentResultPage() {
  const [studentId, setStudentId] = useState("");
  const [examCode, setExamCode] = useState("");
  const [result, setResult] = useState<StudentResult | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    try {
      const data = await api.studentResult({
        studentId: studentId.trim(),
        examCode: examCode.trim().toUpperCase(),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "결과를 조회하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="exam-standalone">
      <section className="exam-client-shell">
        <div className="panel">
          <div className="eyebrow">ProfPilot Result</div>
          <h1>시험 결과 조회</h1>
          <p className="lead">학번과 시험 코드로 제출 결과를 확인합니다. 교수 채점 전에는 채점 대기 상태로 표시됩니다.</p>
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-row">
              <label htmlFor="studentId">학번</label>
              <input
                autoComplete="off"
                autoFocus
                id="studentId"
                inputMode="numeric"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="examCode">시험 코드</label>
              <input
                autoComplete="off"
                id="examCode"
                value={examCode}
                onChange={(event) => setExamCode(event.target.value.toUpperCase())}
                required
              />
            </div>
            {error ? <p className="error">{error}</p> : null}
            <div className="button-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "조회 중..." : "결과 조회"}
              </button>
              <a className="button secondary" href="/exam">
                시험 입장
              </a>
            </div>
          </form>
        </div>

        {result ? (
          <>
            <section className="panel result-summary">
              <h2>{result.title}</h2>
              <div className="result-score-grid">
                <div>
                  <span>학번</span>
                  <strong>{result.studentId}</strong>
                </div>
                <div>
                  <span>채점 상태</span>
                  <strong>{result.gradingStatus === "graded" ? "채점 완료" : "채점 대기"}</strong>
                </div>
                <div>
                  <span>총점</span>
                  <strong>{result.gradingStatus === "graded" ? `${result.totalScore ?? 0} / ${result.maxPoints}` : "-"}</strong>
                </div>
                <div>
                  <span>제출 시각</span>
                  <strong>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "-"}</strong>
                </div>
              </div>
              {result.gradingStatus !== "graded" ? (
                <p className="muted">아직 교수가 일괄채점을 실행하지 않았습니다. 채점 완료 후 문항별 결과가 표시됩니다.</p>
              ) : null}
            </section>

            <section className="result-answer-list">
              {result.answers.map((answer, index) => (
                <article className="panel result-answer-card" key={answer.questionId}>
                  <div className="result-answer-header">
                    <h2>문항 {index + 1}</h2>
                    <strong>{result.gradingStatus === "graded" ? `${answer.score ?? 0} / ${answer.points}` : `- / ${answer.points}`}</strong>
                  </div>
                  <p>{answer.prompt}</p>
                  {assetUrl(answer.imageUrl) ? <img alt="문항 이미지" src={assetUrl(answer.imageUrl)} /> : null}
                  <div className="result-answer-grid">
                    <div>
                      <span>내 답안</span>
                      <strong>{formatValue(answer.answer)}</strong>
                    </div>
                    <div>
                      <span>정답</span>
                      <strong>{result.gradingStatus === "graded" ? formatValue(answer.correctAnswer) : "-"}</strong>
                    </div>
                    <div>
                      <span>결과</span>
                      <strong>{result.gradingStatus === "graded" ? answerStatus(answer.isCorrect, answer.needsManualGrading) : "채점 대기"}</strong>
                    </div>
                  </div>
                  {result.gradingStatus === "graded" && answer.feedback ? (
                    <div className="result-feedback">
                      <span>채점 비고</span>
                      <p>{answer.feedback}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
