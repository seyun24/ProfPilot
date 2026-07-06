"use client";

import type { AvailabilityRule, Consultation, ConsultationBlock, DaySlots } from "@profpilot/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import MonthCalendar, { type DayMarker } from "@/components/MonthCalendar";
import { api } from "@/lib/api";
import {
  addMonths,
  buildMonthGrid,
  formatDateKorean,
  formatHourRange,
  parseDateKey,
  todayKey,
} from "@/lib/calendar";
import { consultationStatusLabel, jsWeekdayToMonday0 } from "@/lib/labels";

export default function StudentConsultationsPage() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string>(() => todayKey());
  const [daySlots, setDaySlots] = useState<DaySlots | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [myRequests, setMyRequests] = useState<Consultation[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [monthBlocks, setMonthBlocks] = useState<ConsultationBlock[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const monthRange = useMemo(() => {
    const cells = buildMonthGrid(viewDate);
    return { from: cells[0].key, to: cells[cells.length - 1].key };
  }, [viewDate]);

  const loadDay = useCallback(async (key: string) => {
    try {
      setDaySlots(await api.daySlots(key));
      setSelectedHour(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const loadMonthContext = useCallback(async () => {
    try {
      const [ruleItems, blockItems] = await Promise.all([
        api.availabilityRules(),
        api.consultationBlocks({ from: monthRange.from, to: monthRange.to }),
      ]);
      setRules(ruleItems);
      setMonthBlocks(blockItems);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [monthRange.from, monthRange.to]);

  const loadMyRequests = useCallback(async () => {
    if (!studentId.trim()) {
      setMyRequests([]);
      return;
    }
    try {
      setMyRequests(await api.consultations({ studentId: studentId.trim() }));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [studentId]);

  useEffect(() => {
    loadDay(selectedKey);
  }, [selectedKey, loadDay]);

  useEffect(() => {
    loadMyRequests();
  }, [loadMyRequests]);

  useEffect(() => {
    loadMonthContext();
  }, [loadMonthContext]);

  const myMarkers = useMemo(() => {
    const map: Record<string, DayMarker> = {};
    // Gray out days with no consultations available (non-working weekdays).
    const workingWeekdays = new Set(rules.map((rule) => rule.weekday));
    for (const cell of buildMonthGrid(viewDate)) {
      const weekday = jsWeekdayToMonday0(parseDateKey(cell.key).getDay());
      if (!workingWeekdays.has(weekday)) {
        (map[cell.key] ??= {}).unavailable = true;
      }
    }
    for (const b of monthBlocks) {
      if (b.startHour == null) (map[b.date] ??= {}).unavailable = true;
    }
    for (const c of myRequests) {
      if (c.status === "rejected") continue;
      const entry = (map[c.date] ??= {});
      if (c.status === "approved") entry.approved = (entry.approved ?? 0) + 1;
      if (c.status === "pending") entry.pending = (entry.pending ?? 0) + 1;
    }
    return map;
  }, [myRequests, rules, monthBlocks, viewDate]);

  async function book() {
    setError("");
    setMessage("");
    if (!studentId.trim()) {
      setError("학번을 입력하세요.");
      return;
    }
    if (selectedHour == null) {
      setError("예약할 시간을 선택하세요.");
      return;
    }
    try {
      await api.createConsultation({
        studentId: studentId.trim(),
        studentName: studentName.trim() || undefined,
        date: selectedKey,
        startHour: selectedHour,
        reason: reason.trim(),
      });
      setReason("");
      setMessage("상담 예약을 신청했습니다. 교수 승인 후 확정됩니다.");
      await Promise.all([loadDay(selectedKey), loadMyRequests()]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">상담 신청</div>
        <h1>상담 예약</h1>
        <p className="lead">
          학번으로 상담을 신청합니다. 예약 가능한 시간(오전 9시 ~ 오후 10시)에서 원하는 시간을 선택하세요.
          신청 후 교수가 승인하면 확정됩니다.
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="form-grid two-col">
          <div className="form-row">
            <label htmlFor="studentId">학번</label>
            <input
              id="studentId"
              placeholder="예: 2026001"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="studentName">이름 (선택)</label>
            <input
              id="studentName"
              placeholder="예: 이학생"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="consult-layout">
        <div className="panel">
          <MonthCalendar
            viewDate={viewDate}
            selectedKey={selectedKey}
            markers={myMarkers}
            onPrevMonth={() => setViewDate((d) => addMonths(d, -1))}
            onNextMonth={() => setViewDate((d) => addMonths(d, 1))}
            onSelectDay={setSelectedKey}
          />
          <div className="calendar-legend">
            <span><span className="dot approved" /> 내 승인된 상담</span>
            <span><span className="dot pending" /> 내 대기 중 신청</span>
            <span><span className="legend-swatch off" /> 상담 불가(휴무)</span>
          </div>
        </div>

        <div className="panel">
          <h2>{formatDateKorean(selectedKey)}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {daySlots?.workingDay ? "예약 가능한 시간을 선택하세요." : "이 날은 상담을 받지 않습니다."}
          </p>

          <div className="slot-grid">
            {daySlots?.slots.map((slot) => {
              const selectable = slot.state === "available";
              const isSelected = selectedHour === slot.hour;
              return (
                <button
                  type="button"
                  key={slot.hour}
                  disabled={!selectable}
                  className={`slot slot-${slot.state} ${isSelected ? "chosen" : ""} ${
                    selectable ? "selectable" : ""
                  }`}
                  onClick={() => selectable && setSelectedHour(slot.hour)}
                >
                  <div className="slot-time">{formatHourRange(slot.hour, slot.hour + 1)}</div>
                  <div className="slot-label">
                    {slot.state === "available" && (isSelected ? "선택됨" : "예약 가능")}
                    {slot.state === "unavailable" && "예약 불가"}
                    {slot.state === "blocked" && "차단됨"}
                    {slot.state === "pending" && "예약 중"}
                    {slot.state === "approved" && "예약 완료"}
                    {slot.state === "past" && "지남"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="block-form">
            <div className="form-row">
              <label htmlFor="reason">상담 사유</label>
              <textarea
                id="reason"
                placeholder="상담하고 싶은 내용을 적어주세요."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button type="button" className="button" onClick={book} disabled={selectedHour == null}>
              {selectedHour == null
                ? "시간을 선택하세요"
                : `${formatHourRange(selectedHour, selectedHour + 1)} 상담 신청`}
            </button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>내 상담 신청 내역</h2>
        {myRequests.length === 0 ? (
          <p className="muted">학번을 입력하면 신청 내역이 표시됩니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>시간</th>
                  <th>상태</th>
                  <th>사유</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateKorean(c.date)}</td>
                    <td>{formatHourRange(c.startHour, c.endHour)}</td>
                    <td>
                      <span className={`badge consult-${c.status}`}>{consultationStatusLabel[c.status]}</span>
                    </td>
                    <td>{c.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
