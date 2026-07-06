"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { saveAuthUser } from "@/components/AuthShell";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const { user } = await api.login({ username: username.trim(), password });
      saveAuthUser(user);
      router.replace(user.role === "professor" ? "/professor/exams" : "/student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-header">
      <div className="eyebrow">로그인</div>
      <h1>아이디와 비밀번호를 입력하세요.</h1>
      <p className="lead">권한에 따라 교수 화면 또는 학생 화면으로 이동합니다. 회원가입은 제공하지 않습니다.</p>
      <form className="panel form-grid login-form" onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="username">아이디</label>
          <input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </div>
        <div className="form-row">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </section>
  );
}
