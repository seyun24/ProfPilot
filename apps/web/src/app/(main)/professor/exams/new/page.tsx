"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const exam = await api.createExam({
        title,
        description,
        durationMinutes: durationMinutes > 0 ? durationMinutes : null,
      });
      router.push(`/professor/exams/${exam.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험을 생성하지 못했습니다.");
    }
  }

  return (
    <section className="page-header">
      <div className="eyebrow">시험 생성</div>
      <h1>수동으로 시험을 만듭니다.</h1>
      <p className="lead">문항은 교수가 직접 추가합니다. AI 시험 생성은 이 모듈에 포함하지 않습니다.</p>
      <form className="panel form-grid" onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="title">제목</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="form-row">
          <label htmlFor="description">설명</label>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="durationMinutes">제한시간(분)</label>
          <input
            id="durationMinutes"
            min={0}
            type="number"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          />
          <p className="muted">0으로 설정하면 시험 클라이언트에 제한시간이 표시되지 않습니다.</p>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="button-row">
          <button className="button" type="submit">
            생성
          </button>
        </div>
      </form>
    </section>
  );
}
