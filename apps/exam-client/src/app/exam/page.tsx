"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";

export default function ExamEntryPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [examCode, setExamCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const normalizedStudentId = studentId.trim();
      const result = await api.validateStudentExam({
        studentId: normalizedStudentId,
        examCode: examCode.trim().toUpperCase(),
      });
      router.push(`/exam/${result.examId}?studentId=${encodeURIComponent(normalizedStudentId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험에 입장하지 못했습니다.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="exam-standalone">
      <section className="exam-login-screen">
        <div className="exam-login-card">
          <div className="eyebrow">ProfPilot Exam Client</div>
          <h1>시험 입장</h1>
          <p className="lead">학번과 시험 코드로 본인 확인 후 시험을 시작합니다.</p>
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
            <button className="button exam-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "확인 중..." : "시험 시작"}
            </button>
            <button className="button secondary exam-login-submit" type="button" onClick={() => router.push("/result")}>
              결과 조회
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
