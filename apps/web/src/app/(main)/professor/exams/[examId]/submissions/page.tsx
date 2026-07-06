"use client";

import type { Submission } from "@profpilot/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { gradingStatusLabel, submissionStatusLabel } from "@/lib/labels";

export default function ExamSubmissionsPage() {
  const { examId } = useParams<{ examId: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.submissions(examId).then(setSubmissions).catch((err: Error) => setError(err.message));
  }, [examId]);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">제출 현황</div>
        <h1>학생 제출 목록</h1>
        <p className="lead">답안 제출 시에는 저장만 하고, 교수 일괄채점 버튼을 눌렀을 때 서버에서 채점합니다.</p>
        <div className="button-row">
          <Link className="button secondary" href={`/professor/exams/${examId}/results`}>
            통계 보기
          </Link>
        </div>
      </section>
      {error ? <p className="error">{error}</p> : null}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>학번</th>
              <th>상태</th>
              <th>채점 상태</th>
              <th>자동 채점 점수</th>
              <th>총점</th>
              <th>수동 채점 대기</th>
              <th>제출 시각</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id}>
                <td>{submission.studentId}</td>
                <td>{submissionStatusLabel[submission.status]}</td>
                <td>{gradingStatusLabel[submission.gradingStatus]}</td>
                <td>{submission.objectiveScore ?? "-"}</td>
                <td>{submission.totalScore ?? "-"}</td>
                <td>{submission.answers.some((answer) => answer.needsManualGrading) ? "예" : "아니오"}</td>
                <td>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "-"}</td>
                <td>
                  <Link className="button secondary compact" href={`/professor/exams/${examId}/submissions/${submission.id}`}>
                    답안 / 수동채점
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
