"use client";

import type { Exam, Question, Submission, SubmissionAnswer } from "@profpilot/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api, PUBLIC_API_BASE_URL } from "@/lib/api";
import { gradingStatusLabel, questionTypeLabel, submissionStatusLabel } from "@/lib/labels";

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

function answerStatus(answer: SubmissionAnswer | undefined) {
  if (!answer) return "미응답";
  if (answer.needsManualGrading) return "수동 채점 필요";
  if (answer.isCorrect === true) return "정답";
  if (answer.isCorrect === false) return "오답";
  return "채점 대기";
}

export default function SubmissionDetailPage() {
  const { examId, submissionId } = useParams<{ examId: string; submissionId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [examData, submissions] = await Promise.all([api.exam(examId), api.submissions(examId)]);
      const current = submissions.find((item) => item.id === submissionId);
      if (!current) {
        throw new Error("제출 답안을 찾지 못했습니다.");
      }
      setExam(examData);
      setSubmission(current);
      setScoreDrafts(Object.fromEntries(current.answers.map((answer) => [answer.id, answer.score?.toString() ?? ""])));
      setFeedbackDrafts(Object.fromEntries(current.answers.map((answer) => [answer.id, answer.feedback ?? ""])));
    }

    load().catch((err: Error) => setError(err.message));
  }, [examId, submissionId]);

  const answersByQuestion = useMemo(() => {
    const entries = submission?.answers.map((answer) => [answer.questionId, answer] as const) ?? [];
    return new Map(entries);
  }, [submission]);

  if (error && (!exam || !submission)) {
    return <p className="error">{error}</p>;
  }

  if (!exam || !submission) {
    return <p className="muted">학생 답안을 불러오는 중...</p>;
  }

  const orderedQuestions = [...exam.questions].sort((a, b) => a.orderIndex - b.orderIndex);

  async function saveScore(answer: SubmissionAnswer, question: Question) {
    const rawScore = scoreDrafts[answer.id] ?? "";
    const score = Number(rawScore);
    if (!Number.isFinite(score) || score < 0 || score > question.points) {
      setError(`점수는 0점부터 ${question.points}점까지 입력할 수 있습니다.`);
      return;
    }
    setError("");
    setMessage("");
    try {
      const updated = await api.updateAnswerScore(answer.id, score, feedbackDrafts[answer.id] ?? "");
      setSubmission(updated);
      setScoreDrafts(Object.fromEntries(updated.answers.map((item) => [item.id, item.score?.toString() ?? ""])));
      setFeedbackDrafts(Object.fromEntries(updated.answers.map((item) => [item.id, item.feedback ?? ""])));
      setMessage("문항 점수와 비고가 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문항 점수를 저장하지 못했습니다.");
    }
  }

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">학생 답안</div>
        <h1>{submission.studentId} 답안 상세</h1>
        <p className="lead">문항별 문제, 학생 답안, 정답, 채점 결과를 확인합니다.</p>
        <div className="button-row">
          <Link className="button secondary" href={`/professor/exams/${examId}/submissions`}>
            제출 목록
          </Link>
          <Link className="button secondary" href={`/professor/exams/${examId}/results`}>
            결과 보기
          </Link>
        </div>
      </section>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="panel">
        <div className="settings-summary">
          <p>시험: <strong>{exam.title}</strong></p>
          <p>제출 상태: <strong>{submissionStatusLabel[submission.status]}</strong></p>
          <p>채점 상태: <strong>{gradingStatusLabel[submission.gradingStatus]}</strong></p>
          <p>총점: <strong>{submission.totalScore ?? "-"}</strong></p>
          <p>제출 시각: <strong>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "-"}</strong></p>
        </div>
      </section>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>유형</th>
              <th>문항</th>
              <th>학생 답안</th>
              <th>정답</th>
              <th>점수</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {orderedQuestions.map((question: Question, index) => {
              const answer = answersByQuestion.get(question.id);
              return (
                <tr key={question.id}>
                  <td>{index + 1}</td>
                  <td>{questionTypeLabel[question.type]}</td>
                  <td>
                    <div className="answer-question-cell">
                      <strong>{question.prompt}</strong>
                      {assetUrl(question.imageUrl) ? (
                        <img alt="문항 이미지" src={assetUrl(question.imageUrl)} />
                      ) : null}
                    </div>
                  </td>
                  <td>{formatValue(answer?.answer)}</td>
                  <td>{formatValue(question.correctAnswer)}</td>
                  <td>
                    {answer ? (
                      <div className="score-cell">
                        <strong>{answer.score ?? "-"} / {question.points}</strong>
                        <div className="manual-score-control">
                          <input
                            aria-label={`${index + 1}번 문항 점수`}
                            max={question.points}
                            min={0}
                            step="0.5"
                            type="number"
                            value={scoreDrafts[answer.id] ?? ""}
                            onChange={(event) =>
                              setScoreDrafts((current) => ({
                                ...current,
                                [answer.id]: event.target.value,
                              }))
                            }
                          />
                          <button className="button secondary compact" type="button" onClick={() => saveScore(answer, question)}>
                            점수 저장
                          </button>
                        </div>
                        <textarea
                          aria-label={`${index + 1}번 문항 채점 비고`}
                          className="manual-feedback"
                          placeholder="채점 비고: 어떤 기준으로 점수를 줬는지 적으세요."
                          value={feedbackDrafts[answer.id] ?? ""}
                          onChange={(event) =>
                            setFeedbackDrafts((current) => ({
                              ...current,
                              [answer.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{answerStatus(answer)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
