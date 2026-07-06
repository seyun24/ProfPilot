"use client";

import type { Exam } from "@profpilot/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

function hasImageUrl(path: string | null | undefined) {
  return Boolean(path?.trim());
}

export default function ExamPreviewPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);

  useEffect(() => {
    api.exam(examId).then(setExam);
  }, [examId]);

  if (!exam) return <p className="muted">미리보기를 불러오는 중...</p>;

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">학생 화면 미리보기</div>
        <h1>{exam.title}</h1>
        <p className="lead">{exam.description || "설명이 없습니다."}</p>
      </section>

      <section className="stack">
        {exam.questions.map((question, index) => (
          <div className="panel" key={question.id}>
            <p className="muted">
              문항 {index + 1} - {question.points}점
            </p>
            <h2>{question.prompt}</h2>
            {hasImageUrl(question.imageUrl) ? <p className="muted">첨부 이미지: {question.imageUrl}</p> : null}
            {question.type === "multiple_choice" && question.options ? (
              <div className="form-grid">
                {question.options.map((option) => (
                  <label key={option}>
                    <input type="radio" name={question.id} disabled /> {option}
                  </label>
                ))}
              </div>
            ) : null}
            {question.type === "ox" ? (
              <div className="button-row">
                <button className="button secondary" disabled>O</button>
                <button className="button secondary" disabled>X</button>
              </div>
            ) : null}
            {question.type === "short_answer" ? <input disabled placeholder="단답형 답안" /> : null}
            {question.type === "essay" ? <textarea disabled placeholder="서술형 답안" /> : null}
          </div>
        ))}
      </section>
    </>
  );
}
