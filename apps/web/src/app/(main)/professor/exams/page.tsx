"use client";

import type { Exam } from "@profpilot/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { examStatusLabel } from "@/lib/labels";

export default function ProfessorExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.exams().then(setExams).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">시험 모듈</div>
        <h1>교수 시험 관리</h1>
        <p className="lead">시험을 생성하고, 문항을 관리하고, 응시 대상 학생과 제출 결과를 확인합니다.</p>
        <div className="button-row">
          <Link className="button" href="/professor/exams/new">
            시험 생성
          </Link>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>제목</th>
                <th>상태</th>
                <th>시험 코드</th>
                <th>문항 수</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>
                    <span className={`badge ${exam.status}`}>{examStatusLabel[exam.status]}</span>
                  </td>
                  <td>{exam.examCode ?? "미공개"}</td>
                  <td>{exam.questions.length}</td>
                  <td>
                    <div className="button-row" style={{ marginTop: 0 }}>
                      <Link className="button secondary" href={`/professor/exams/${exam.id}`}>
                        편집
                      </Link>
                      <Link className="button secondary" href={`/professor/exams/${exam.id}/submissions`}>
                        제출 현황
                      </Link>
                      <Link className="button secondary" href={`/professor/exams/${exam.id}/results`}>
                        결과
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    아직 생성된 시험이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
