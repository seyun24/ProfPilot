"use client";

import type { AllowedStudent, Exam, Question, QuestionType } from "@profpilot/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";

import { api, PUBLIC_API_BASE_URL } from "@/lib/api";
import { examStatusLabel, questionTypeLabel } from "@/lib/labels";

const questionTypes: QuestionType[] = ["multiple_choice", "ox", "short_answer", "essay"];
type EditorTab = "questions" | "exam" | "students";

const templates: Array<{
  type: QuestionType;
  label: string;
  prompt: string;
  points: number;
  options: string[];
  correctAnswer: string;
}> = [
  {
    type: "multiple_choice",
    label: "객관식",
    prompt: "다음 중 올바른 것을 고르시오.",
    points: 5,
    options: ["선택지 A", "선택지 B", "선택지 C", "선택지 D"],
    correctAnswer: "선택지 A",
  },
  {
    type: "ox",
    label: "OX",
    prompt: "다음 설명이 맞으면 O, 틀리면 X를 선택하시오.",
    points: 3,
    options: ["O", "X"],
    correctAnswer: "O",
  },
  {
    type: "short_answer",
    label: "단답형",
    prompt: "정답을 짧게 작성하시오.",
    points: 5,
    options: [],
    correctAnswer: "",
  },
  {
    type: "essay",
    label: "서술형",
    prompt: "근거를 포함하여 서술하시오.",
    points: 10,
    options: [],
    correctAnswer: "",
  },
];

const defaultMultipleChoiceOptions = ["선택지 A", "선택지 B", "선택지 C", "선택지 D"];
const oxOptions = ["O", "X"];
type StudentInput = { studentId: string; studentName?: string };

function cleanOptions(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean);
}

function assetUrl(path: string | null | undefined) {
  const cleanPath = path?.trim();
  if (!cleanPath) return "";
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${PUBLIC_API_BASE_URL}${cleanPath}`;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s|_|-/g, "");
}

function parseStudentRows(rows: unknown[][]): StudentInput[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  const studentIdIndex = headers.findIndex((header) => ["학번", "studentid", "id", "studentnumber", "번호"].includes(header));
  const studentNameIndex = headers.findIndex((header) => ["이름", "성명", "studentname", "name"].includes(header));

  if (studentIdIndex === -1) {
    throw new Error("엑셀 첫 행에 학번 컬럼이 필요합니다. 예: 학번, 이름");
  }

  const seen = new Set<string>();
  return rows
    .slice(1)
    .map((row) => {
      const studentId = String(row[studentIdIndex] ?? "").trim();
      const studentName = studentNameIndex >= 0 ? String(row[studentNameIndex] ?? "").trim() : "";
      return { studentId, studentName: studentName || undefined };
    })
    .filter((student) => {
      if (!student.studentId || seen.has(student.studentId)) return false;
      seen.add(student.studentId);
      return true;
    });
}

function studentsToText(parsed: StudentInput[]) {
  return parsed.map((student) => [student.studentId, student.studentName].filter(Boolean).join(" ")).join("\n");
}

function parseStudentLine(line: string): StudentInput {
  const normalized = line.trim();
  if (normalized.includes(",")) {
    const [studentId, ...nameParts] = normalized.split(",").map((part) => part.trim());
    return { studentId, studentName: nameParts.join(" ").trim() || undefined };
  }
  const [studentId, ...nameParts] = normalized.split(/\s+/);
  return { studentId, studentName: nameParts.join(" ").trim() || undefined };
}

export default function ExamEditorPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const [exam, setExam] = useState<Exam | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState(defaultMultipleChoiceOptions);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [students, setStudents] = useState("");
  const [allowedStudents, setAllowedStudents] = useState<AllowedStudent[]>([]);
  const [studentDrafts, setStudentDrafts] = useState<Record<string, StudentInput>>({});
  const [settingsTab, setSettingsTab] = useState<EditorTab>("questions");
  const [isUploadingStudents, setIsUploadingStudents] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const data = await api.exam(examId);
    setExam(data);
    setTitle(data.title);
    setDescription(data.description);
    setDurationMinutes(data.durationMinutes ?? 0);
  }

  async function refreshAllowedStudents() {
    const data = await api.allowedStudents(examId);
    setAllowedStudents(data);
    setStudentDrafts(
      Object.fromEntries(
        data.map((student) => [
          student.id,
          {
            studentId: student.studentId,
            studentName: student.studentName ?? "",
          },
        ]),
      ),
    );
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
    refreshAllowedStudents().catch((err: Error) => setError(err.message));
  }, [examId]);

  useEffect(() => {
    if (!questionImage) {
      setQuestionImagePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(questionImage);
    setQuestionImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [questionImage]);

  async function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const updated = await api.updateExam(examId, {
      title,
      description,
      durationMinutes: durationMinutes > 0 ? durationMinutes : null,
    });
    setExam(updated);
    setMessage("시험 정보가 저장되었습니다.");
  }

  async function saveExamSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const updated = await api.updateExam(examId, {
        durationMinutes: durationMinutes > 0 ? durationMinutes : null,
      });
      setExam(updated);
      setMessage("시험 설정이 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험 설정을 저장하지 못했습니다.");
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const optionList = type === "multiple_choice" ? cleanOptions(options) : type === "ox" ? oxOptions : null;
    const answer = type === "multiple_choice" ? correctAnswer || optionList?.[0] : correctAnswer;

    if (type === "multiple_choice" && (!optionList || optionList.length < 2)) {
      setError("객관식 선택지는 최소 2개 이상 필요합니다.");
      return;
    }

    try {
      const question = await api.createQuestion(examId, {
        type,
        prompt,
        points,
        orderIndex: exam?.questions.length ?? 0,
        options: optionList,
        correctAnswer: answer,
      });
      if (questionImage) {
        await api.uploadQuestionImage(question.id, questionImage);
      }
      setPrompt("");
      setCorrectAnswer("");
      setOptions(defaultMultipleChoiceOptions);
      setQuestionImage(null);
      setSelectedQuestionId(question.id);
      await refresh();
      setMessage("문항이 추가되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문항을 추가하지 못했습니다.");
    }
  }

  function applyTemplate(template: (typeof templates)[number]) {
    setSelectedQuestionId(null);
    setType(template.type);
    setPrompt(template.prompt);
    setPoints(template.points);
    setOptions(template.options);
    setCorrectAnswer(template.correctAnswer);
  }

  function changeQuestionType(nextType: QuestionType) {
    setType(nextType);
    if (nextType === "multiple_choice") {
      setOptions(options.length >= 2 ? options : defaultMultipleChoiceOptions);
      setCorrectAnswer(options[0] ?? defaultMultipleChoiceOptions[0]);
    } else if (nextType === "ox") {
      setOptions(oxOptions);
      setCorrectAnswer("O");
    } else {
      setOptions([]);
      setCorrectAnswer("");
    }
  }

  async function updateQuestion(questionId: string, payload: Partial<{
    type: QuestionType;
    prompt: string;
    points: number;
    orderIndex: number;
    options: string[] | null;
    correctAnswer: unknown;
  }>) {
    await api.updateQuestion(questionId, payload);
    await refresh();
    setMessage("문항이 수정되었습니다.");
  }

  async function publish() {
    setError("");
    try {
      const updated = await api.publishExam(examId);
      setExam(updated);
      setMessage(`시험이 공개되었습니다. 시험 코드: ${updated.examCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험을 공개하지 못했습니다.");
    }
  }

  async function close() {
    const updated = await api.closeExam(examId);
    setExam(updated);
    setMessage("시험이 마감되었습니다.");
  }

  async function registerStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = students
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseStudentLine)
      .filter((student) => student.studentId);
    try {
      await api.addAllowedStudents(examId, parsed);
      await refreshAllowedStudents();
      setMessage(`응시 대상 학생 ${parsed.length}명이 등록되었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "학생을 등록하지 못했습니다.");
    }
  }

  async function uploadStudentsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setMessage("");
    setIsUploadingStudents(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows: unknown[][];

      if (extension === "csv") {
        const text = await file.text();
        rows = text
          .split(/\r?\n/)
          .map((line) => line.split(",").map((cell) => cell.trim()))
          .filter((row) => row.some(Boolean));
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("엑셀 파일에 시트가 없습니다.");
        }
        rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
          header: 1,
          blankrows: false,
          defval: "",
        });
      }

      const parsed = parseStudentRows(rows);
      if (parsed.length === 0) {
        throw new Error("등록할 학생 데이터가 없습니다.");
      }

      await api.addAllowedStudents(examId, parsed);
      await refreshAllowedStudents();
      setStudents(studentsToText(parsed));
      setMessage(`엑셀/CSV에서 응시 대상 학생 ${parsed.length}명이 등록되었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "학생 파일을 업로드하지 못했습니다.");
    } finally {
      setIsUploadingStudents(false);
    }
  }

  async function uploadImage(questionId: string, file: File) {
    await api.uploadQuestionImage(questionId, file);
    await refresh();
    setMessage("문항 이미지가 업로드되었습니다.");
  }

  function updateStudentDraft(studentId: string, field: keyof StudentInput, value: string) {
    setStudentDrafts((current) => ({
      ...current,
      [studentId]: {
        studentId: current[studentId]?.studentId ?? "",
        studentName: current[studentId]?.studentName,
        [field]: value,
      },
    }));
  }

  async function saveAllowedStudent(student: AllowedStudent) {
    const draft = studentDrafts[student.id];
    if (!draft?.studentId?.trim()) {
      setError("학번은 비울 수 없습니다.");
      return;
    }
    setError("");
    try {
      await api.updateAllowedStudent(examId, student.id, {
        studentId: draft.studentId.trim(),
        studentName: draft.studentName?.trim() || null,
      });
      await refreshAllowedStudents();
      setMessage("학생 정보가 수정되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "학생 정보를 수정하지 못했습니다.");
    }
  }

  async function deleteAllowedStudent(student: AllowedStudent) {
    if (!window.confirm(`${student.studentId} 학생을 응시 대상에서 삭제할까요?`)) {
      return;
    }
    setError("");
    try {
      await api.deleteAllowedStudent(examId, student.id);
      await refreshAllowedStudents();
      setMessage("학생이 응시 대상에서 삭제되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "학생을 삭제하지 못했습니다.");
    }
  }

  if (!exam) {
    return <p className="muted">시험을 불러오는 중...</p>;
  }

  const selectedQuestion = exam.questions.find((question) => question.id === selectedQuestionId) ?? null;

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">시험 편집</div>
        <h1>{exam.title}</h1>
        <p className="lead">시험 정보를 수정하고, 문항을 직접 추가하고, 응시 대상 학생을 등록한 뒤 시험 코드를 발급합니다.</p>
        <div className="button-row">
          <Link className="button secondary" href={`/professor/exams/${examId}/preview`}>
            학생 화면 미리보기
          </Link>
          <Link className="button secondary" href={`/professor/exams/${examId}/submissions`}>
            제출 현황 보기
          </Link>
          <Link className="button secondary" href={`/professor/exams/${examId}/results`}>
            결과 보기
          </Link>
          <div className="editor-header-tabs" role="tablist" aria-label="시험 편집 탭">
            <button
              className={`settings-tab ${settingsTab === "questions" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("questions")}
            >
              문항 작성
            </button>
            <button
              className={`settings-tab ${settingsTab === "exam" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("exam")}
            >
              시험 설정
            </button>
            <button
              className={`settings-tab ${settingsTab === "students" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("students")}
            >
              응시 대상 학생
            </button>
          </div>
        </div>
      </section>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {settingsTab === "exam" ? (
        <section className="editor-band exam-settings-panel">
          <form className="form-grid" onSubmit={saveExamSettings}>
            <div className="section-heading">
              <div>
                <h2>시험 설정</h2>
                <p className="muted">시험 정보, 제한시간, 공개 상태를 설정합니다.</p>
              </div>
              <button className="button secondary compact" type="submit">
                설정 저장
              </button>
            </div>
            <div className="form-row">
              <label htmlFor="title">제목</label>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="description">설명</label>
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="settings-summary">
              <p>상태: <span className={`badge ${exam.status}`}>{examStatusLabel[exam.status]}</span></p>
              <p>시험 코드: <strong>{exam.examCode ?? "미발급"}</strong></p>
            </div>
            <div className="form-row">
              <label htmlFor="settings-durationMinutes">제한시간(분)</label>
              <input
                id="settings-durationMinutes"
                min={0}
                type="number"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
              />
              <p className="muted">0으로 설정하면 시험 클라이언트에 제한시간이 표시되지 않습니다.</p>
            </div>
            <div className="button-row">
              <button className="button" type="button" onClick={publish}>
                시험 코드 생성 / 공개
              </button>
              <button className="button secondary" type="button" onClick={close}>
                마감
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {settingsTab === "students" ? (
        <section className="editor-band exam-settings-panel">
          <form className="form-grid" onSubmit={registerStudents}>
            <div className="section-heading">
              <div>
                <h2>응시 대상 학생</h2>
                <p className="muted">등록된 학번만 학생 시험 화면에 입장할 수 있습니다.</p>
              </div>
              <button className="button secondary compact" disabled={isUploadingStudents} type="submit">
                학생 등록
              </button>
            </div>
            <div className="form-row">
              <label htmlFor="students-file">엑셀/CSV 업로드</label>
              <input
                accept=".xlsx,.xls,.csv"
                disabled={isUploadingStudents}
                id="students-file"
                type="file"
                onChange={uploadStudentsFile}
              />
              <p className="muted">첫 행 컬럼명: 학번, 이름 또는 studentId, studentName</p>
            </div>
            <div className="form-row">
              <label htmlFor="students-text">수동 입력</label>
              <textarea
                id="students-text"
                placeholder={"2026001 이학생\n2026002 박학생"}
                value={students}
                onChange={(event) => setStudents(event.target.value)}
              />
              <p className="muted">한 줄에 한 명씩 입력하세요: 학번 이름</p>
            </div>
            <div className="student-list-header">
              <h3>등록된 학생 {allowedStudents.length}명</h3>
              <button className="button secondary compact" type="button" onClick={() => refreshAllowedStudents()}>
                새로고침
              </button>
            </div>
            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>학번</th>
                    <th>이름</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {allowedStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <input
                          aria-label={`${student.studentId} 학번`}
                          value={studentDrafts[student.id]?.studentId ?? student.studentId}
                          onChange={(event) => updateStudentDraft(student.id, "studentId", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${student.studentId} 이름`}
                          value={studentDrafts[student.id]?.studentName ?? student.studentName ?? ""}
                          onChange={(event) => updateStudentDraft(student.id, "studentName", event.target.value)}
                        />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="button secondary compact" type="button" onClick={() => saveAllowedStudent(student)}>
                            저장
                          </button>
                          <button className="button secondary compact" type="button" onClick={() => deleteAllowedStudent(student)}>
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allowedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3}>등록된 응시 대상 학생이 없습니다.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </form>
        </section>
      ) : null}

      {settingsTab === "questions" ? (
      <div className="exam-editor-layout">
        <section className="exam-editor-main">
          <section className="editor-band question-workspace">
            {selectedQuestion ? (
              <>
                <div className="workspace-header">
                  <div>
                    <h2>문항 {exam.questions.findIndex((question) => question.id === selectedQuestion.id) + 1} 수정</h2>
                    <p className="muted">한 번에 한 문항만 편집합니다. 오른쪽 목차에서 다른 문항으로 이동하세요.</p>
                  </div>
                  <button className="button secondary" type="button" onClick={() => setSelectedQuestionId(null)}>
                    새 문항 작성
                  </button>
                </div>
                <QuestionEditor
                  index={exam.questions.findIndex((question) => question.id === selectedQuestion.id)}
                  key={selectedQuestion.id}
                  question={selectedQuestion}
                  onSave={updateQuestion}
                  onUpload={uploadImage}
                />
              </>
            ) : (
              <form className="form-grid" onSubmit={addQuestion}>
                <div className="workspace-header">
                  <div>
                    <h2>새 문항 작성</h2>
                    <p className="muted">템플릿을 고른 뒤 문항, 선택지, 정답, 이미지를 구성하세요.</p>
                  </div>
                </div>
                <div className="form-row">
                  <label>문제 템플릿</label>
                  <div className="button-row" style={{ marginTop: 0 }}>
                    {templates.map((template) => (
                      <button
                        className="button secondary"
                        key={template.type}
                        type="button"
                        onClick={() => applyTemplate(template)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="type">문항 유형</label>
                  <select id="type" value={type} onChange={(event) => changeQuestionType(event.target.value as QuestionType)}>
                    {questionTypes.map((item) => (
                      <option key={item} value={item}>
                        {questionTypeLabel[item]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="prompt">문항 내용</label>
                  <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} required />
                </div>
                <div className="form-row">
                  <label htmlFor="points">배점</label>
                  <input id="points" type="number" min={1} value={points} onChange={(event) => setPoints(Number(event.target.value))} />
                </div>
                {type === "multiple_choice" ? (
                  <ChoiceEditor
                    correctAnswer={correctAnswer}
                    options={options}
                    setCorrectAnswer={setCorrectAnswer}
                    setOptions={setOptions}
                  />
                ) : null}
                {type === "multiple_choice" ? (
                  <div className="form-row">
                    <label htmlFor="correct">정답</label>
                    <select id="correct" value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} required>
                      {cleanOptions(options).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {type === "ox" ? (
                  <div className="form-row">
                    <label htmlFor="correct">정답</label>
                    <select id="correct" value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} required>
                      {oxOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {type === "short_answer" ? (
                  <div className="form-row">
                    <label htmlFor="correct">정답 / 채점 키워드</label>
                    <input id="correct" value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} required />
                    <p className="muted">여러 키워드는 쉼표 또는 공백으로 구분하면 포함 개수에 따라 부분점수가 계산됩니다.</p>
                  </div>
                ) : null}
                {type === "essay" ? (
                  <div className="form-row">
                    <label htmlFor="correct">자동채점 키워드</label>
                    <textarea id="correct" value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} />
                    <p className="muted">비워두면 자동채점 후 수동 채점 대기로 남습니다. 키워드를 입력하면 포함 개수 비율로 부분점수가 계산됩니다.</p>
                  </div>
                ) : null}
                <div className="form-row">
                  <label htmlFor="question-image">문제 이미지 첨부</label>
                  <input id="question-image" type="file" accept="image/*" onChange={(event) => setQuestionImage(event.target.files?.[0] ?? null)} />
                  {questionImage ? <p className="muted">선택된 이미지: {questionImage.name}</p> : null}
                  {questionImagePreview ? (
                    <div className="question-image-preview">
                      <img alt="새 문항 첨부 이미지 미리보기" src={questionImagePreview} />
                    </div>
                  ) : null}
                </div>
                <button className="button" type="submit">
                  문항 저장
                </button>
              </form>
            )}
          </section>
        </section>

        <aside className="exam-editor-side">
          <section className="side-panel">
            <h2>문항 목차</h2>
            <p className="muted">번호를 눌러 한 문항씩 편집합니다.</p>
            <div className="question-tabs">
              <button
                className={`question-tab ${selectedQuestionId === null ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedQuestionId(null)}
              >
                +
              </button>
              {exam.questions.map((question, index) => (
                <button
                  className={`question-tab ${selectedQuestionId === question.id ? "active" : ""}`}
                  key={question.id}
                  type="button"
                  onClick={() => setSelectedQuestionId(question.id)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            {exam.questions.length === 0 ? <p className="muted">아직 저장된 문항이 없습니다.</p> : null}
          </section>
        </aside>
      </div>
      ) : null}
    </>
  );
}

function QuestionEditor({
  index,
  question,
  onSave,
  onUpload,
}: {
  index: number;
  question: Question;
  onSave: (
    questionId: string,
    payload: Partial<{
      type: QuestionType;
      prompt: string;
      points: number;
      orderIndex: number;
      options: string[] | null;
      correctAnswer: unknown;
    }>,
  ) => Promise<void>;
  onUpload: (questionId: string, file: File) => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>(question.type);
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(question.points);
  const [options, setOptions] = useState(question.type === "multiple_choice" ? question.options ?? defaultMultipleChoiceOptions : question.type === "ox" ? oxOptions : []);
  const [correctAnswer, setCorrectAnswer] = useState(String(question.correctAnswer ?? ""));
  const [imageFile, setImageFile] = useState<File | null>(null);

  function changeType(nextType: QuestionType) {
    setType(nextType);
    if (nextType === "multiple_choice") {
      const nextOptions = options.length >= 2 ? options : defaultMultipleChoiceOptions;
      setOptions(nextOptions);
      setCorrectAnswer(nextOptions[0] ?? "");
    } else if (nextType === "ox") {
      setOptions(oxOptions);
      setCorrectAnswer("O");
    } else {
      setOptions([]);
      setCorrectAnswer("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const optionList = type === "multiple_choice" ? cleanOptions(options) : type === "ox" ? oxOptions : null;
    await onSave(question.id, {
      type,
      prompt,
      points,
      orderIndex: index,
      options: optionList,
      correctAnswer: type === "multiple_choice" ? correctAnswer || optionList?.[0] : correctAnswer,
    });
    if (imageFile) {
      await onUpload(question.id, imageFile);
      setImageFile(null);
    }
  }

  return (
    <form className="form-grid question-single-editor" onSubmit={save}>
      <p className="muted">
        {index + 1}. {questionTypeLabel[type]} - {points}점
      </p>
      <div className="form-row">
        <label htmlFor={`type-${question.id}`}>문항 유형</label>
        <select id={`type-${question.id}`} value={type} onChange={(event) => changeType(event.target.value as QuestionType)}>
          {questionTypes.map((item) => (
            <option key={item} value={item}>
              {questionTypeLabel[item]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor={`prompt-${question.id}`}>문항 내용</label>
        <textarea id={`prompt-${question.id}`} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor={`points-${question.id}`}>배점</label>
        <input id={`points-${question.id}`} min={1} type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} />
      </div>
      {type === "multiple_choice" ? (
        <ChoiceEditor
          correctAnswer={correctAnswer}
          options={options}
          setCorrectAnswer={setCorrectAnswer}
          setOptions={setOptions}
        />
      ) : null}
      {type === "multiple_choice" ? (
        <div className="form-row">
          <label htmlFor={`correct-${question.id}`}>정답</label>
          <select id={`correct-${question.id}`} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)}>
            {cleanOptions(options).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {type === "ox" ? (
        <div className="form-row">
          <label htmlFor={`correct-${question.id}`}>정답</label>
          <select id={`correct-${question.id}`} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)}>
            {oxOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {type === "short_answer" ? (
        <div className="form-row">
          <label htmlFor={`correct-${question.id}`}>정답 / 채점 키워드</label>
          <input id={`correct-${question.id}`} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} />
          <p className="muted">여러 키워드는 쉼표 또는 공백으로 구분하면 포함 개수에 따라 부분점수가 계산됩니다.</p>
        </div>
      ) : null}
      {type === "essay" ? (
        <div className="form-row">
          <label htmlFor={`correct-${question.id}`}>자동채점 키워드</label>
          <textarea id={`correct-${question.id}`} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} />
          <p className="muted">비워두면 자동채점 후 수동 채점 대기로 남습니다. 키워드를 입력하면 포함 개수 비율로 부분점수가 계산됩니다.</p>
        </div>
      ) : null}
      {assetUrl(question.imageUrl) ? (
        <div className="question-image-preview">
          <img alt="문항 첨부 이미지" src={assetUrl(question.imageUrl)} />
        </div>
      ) : null}
      <div className="form-row">
        <label htmlFor={`image-${question.id}`}>문항 이미지 첨부</label>
        <input id={`image-${question.id}`} type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
        {imageFile ? <p className="muted">선택된 이미지: {imageFile.name} - 저장 버튼을 누르면 업로드됩니다.</p> : null}
      </div>
      <button className="button secondary" type="submit">
        문항 수정 저장
      </button>
    </form>
  );
}

function ChoiceEditor({
  correctAnswer,
  options,
  setCorrectAnswer,
  setOptions,
}: {
  correctAnswer: string;
  options: string[];
  setCorrectAnswer: (answer: string) => void;
  setOptions: (options: string[]) => void;
}) {
  function updateOption(index: number, value: string) {
    if (options[index] === correctAnswer) {
      setCorrectAnswer(value);
    }
    setOptions(options.map((option, currentIndex) => (currentIndex === index ? value : option)));
  }

  function addOption() {
    setOptions([...options, `선택지 ${options.length + 1}`]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    const nextOptions = options.filter((_, currentIndex) => currentIndex !== index);
    if (options[index] === correctAnswer) {
      setCorrectAnswer(nextOptions[0] ?? "");
    }
    setOptions(nextOptions);
  }

  return (
    <div className="form-row">
      <label>선택지</label>
      <div className="choice-list">
        {options.map((option, index) => (
          <div className="choice-row" key={index}>
            <input
              aria-label={`선택지 ${index + 1}`}
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
            />
            <button
              className="button secondary compact"
              disabled={options.length <= 2}
              type="button"
              onClick={() => removeOption(index)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <button className="button secondary compact" type="button" onClick={addOption}>
        + 선택지 추가
      </button>
    </div>
  );
}
