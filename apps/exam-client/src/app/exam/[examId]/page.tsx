"use client";

import type { StudentExam, StudentQuestion } from "@profpilot/shared";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, PUBLIC_API_BASE_URL } from "@/lib/api";

function assetUrl(path: string | null | undefined) {
  const cleanPath = path?.trim();
  if (!cleanPath) return "";
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${PUBLIC_API_BASE_URL}${cleanPath}`;
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function answerCount(questions: StudentQuestion[], answers: Record<string, string>) {
  return questions.filter((question) => {
    const value = answers[question.id];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
}

export default function ExamTakePage() {
  const { examId } = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get("studentId") ?? "";
  const [exam, setExam] = useState<StudentExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const storageKey = useMemo(() => `profpilot-exam-deadline:${examId}:${studentId}`, [examId, studentId]);

  const payload = useMemo(
    () => ({
      studentId,
      answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
    }),
    [answers, studentId],
  );

  const submitExam = useCallback(
    async (reason: "manual" | "timeout") => {
      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setIsSubmitting(true);
      setError("");
      setMessage(reason === "timeout" ? "제한시간이 종료되어 답안을 전송합니다." : "답안을 전송합니다.");
      try {
        const submission = await api.submitExam(examId, payload);
        window.sessionStorage.removeItem(storageKey);
        router.push(`/exam/submitted?submissionId=${submission.id}`);
      } catch (err) {
        submitLockRef.current = false;
        setIsSubmitting(false);
        setError(err instanceof Error ? err.message : "시험을 제출하지 못했습니다.");
      }
    },
    [examId, payload, router, storageKey],
  );

  useEffect(() => {
    if (!studentId) {
      setError("학번이 없습니다. 입장 화면에서 다시 시작하세요.");
      return;
    }
    api.studentExam(examId, studentId).then(setExam).catch((err: Error) => setError(err.message));
  }, [examId, studentId]);

  useEffect(() => {
    if (!exam || !exam.durationMinutes || exam.durationMinutes <= 0) {
      setRemainingSeconds(null);
      return;
    }

    const storedDeadline = Number(window.sessionStorage.getItem(storageKey));
    const deadline =
      Number.isFinite(storedDeadline) && storedDeadline > Date.now()
        ? storedDeadline
        : Date.now() + exam.durationMinutes * 60 * 1000;
    window.sessionStorage.setItem(storageKey, String(deadline));

    function tick() {
      const nextRemaining = Math.ceil((deadline - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, nextRemaining));
      if (nextRemaining <= 0) {
        void submitExam("timeout");
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [exam, storageKey, submitExam]);

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      await api.saveAnswers(examId, payload);
      setMessage("답안이 서버에 임시 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "답안을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitExam("manual");
  }

  function setAnswer(questionId: string, answer: string) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  if (error) {
    return (
      <main className="exam-standalone">
        <section className="exam-client-shell">
          <div className="panel">
            <p className="error">{error}</p>
            <button className="button secondary" type="button" onClick={() => router.push("/exam")}>
              입장 화면으로 돌아가기
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!exam) {
    return (
      <main className="exam-standalone">
        <p className="muted">시험을 불러오는 중...</p>
      </main>
    );
  }

  const answered = answerCount(exam.questions, answers);
  const total = exam.questions.length;
  const isTimeCritical = remainingSeconds !== null && remainingSeconds <= 60;

  return (
    <main className="exam-standalone">
      <form className="exam-client-shell" onSubmit={submit}>
        <header className="exam-client-header">
          <div>
            <div className="eyebrow">시험 응시</div>
            <h1>{exam.title}</h1>
            <p className="lead">{exam.description || "각 문항에 답한 뒤 완료되면 제출하세요."}</p>
          </div>
          <div className={`exam-timer ${isTimeCritical ? "critical" : ""}`}>
            <span>남은 시간</span>
            <strong>{remainingSeconds === null ? "제한 없음" : formatTime(remainingSeconds)}</strong>
          </div>
        </header>

        <section className="exam-status-bar" aria-label="시험 상태">
          <span>학번: {studentId}</span>
          <span>
            답안 작성: {answered}/{total}
          </span>
          <span>제출 후 ProfPilot 서버로 전송되며 교수 일괄채점 전까지 채점되지 않습니다.</span>
        </section>

        {message ? <p className="success">{message}</p> : null}

        <div className="exam-question-list">
          {exam.questions.map((question, index) => (
            <section className="exam-question-card" key={question.id}>
              <div className="exam-question-meta">
                <span>문항 {index + 1}</span>
                <span>{question.points}점</span>
              </div>
              <h2>{question.prompt}</h2>
              {assetUrl(question.imageUrl) ? (
                <div className="exam-question-image">
                  <img alt={`문항 ${index + 1} 첨부 이미지`} src={assetUrl(question.imageUrl)} />
                </div>
              ) : null}

              {question.type === "multiple_choice" && question.options ? (
                <div className="exam-choice-list">
                  {question.options.map((option, optionIndex) => (
                    <label className="exam-choice" key={`${question.id}-${optionIndex}`}>
                      <input
                        name={question.id}
                        type="radio"
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(event) => setAnswer(question.id, event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {question.type === "ox" ? (
                <div className="exam-ox-list">
                  {["O", "X"].map((option) => (
                    <label className="exam-choice" key={option}>
                      <input
                        name={question.id}
                        type="radio"
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(event) => setAnswer(question.id, event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {question.type === "short_answer" ? (
                <input
                  autoComplete="off"
                  placeholder="단답형 답안"
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                />
              ) : null}

              {question.type === "essay" ? (
                <textarea
                  placeholder="서술형 답안"
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                />
              ) : null}
            </section>
          ))}
        </div>

        <footer className="exam-submit-bar">
          <div>
            <strong>{answered}/{total}</strong>
            <span className="muted"> 문항 답안 작성됨</span>
          </div>
          <div className="button-row">
            <button className="button secondary" disabled={isSaving || isSubmitting} type="button" onClick={save}>
              {isSaving ? "저장 중..." : "임시 저장"}
            </button>
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "전송 중..." : "최종 제출"}
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}
