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
import { consultationStatusLabel, jsWeekdayToMonday0, weekdayLabels } from "@/lib/labels";

const HOURS = Array.from({ length: 22 - 9 }, (_, i) => 9 + i); // 9..21

type WeekdayForm = {
  enabled: boolean;
  startHour: number;
  endHour: number;
};

function emptyWeekForm(): WeekdayForm[] {
  return Array.from({ length: 7 }, () => ({ enabled: false, startHour: 9, endHour: 22 }));
}

export default function ProfessorConsultationsPage() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string>(() => todayKey());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [blocks, setBlocks] = useState<ConsultationBlock[]>([]);
  const [daySlots, setDaySlots] = useState<DaySlots | null>(null);
  const [week, setWeek] = useState<WeekdayForm[]>(emptyWeekForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Block form (for the selected day)
  const [blockWholeDay, setBlockWholeDay] = useState(true);
  const [blockStart, setBlockStart] = useState(9);
  const [blockEnd, setBlockEnd] = useState(22);
  const [blockReason, setBlockReason] = useState("");

  const monthRange = useMemo(() => {
    const cells = buildMonthGrid(viewDate);
    return { from: cells[0].key, to: cells[cells.length - 1].key };
  }, [viewDate]);

  const loadMonth = useCallback(async () => {
    try {
      const [items, blockItems] = await Promise.all([
        api.consultations({ from: monthRange.from, to: monthRange.to }),
        api.consultationBlocks({ from: monthRange.from, to: monthRange.to }),
      ]);
      setConsultations(items);
      setBlocks(blockItems);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [monthRange.from, monthRange.to]);

  const loadDay = useCallback(async (key: string) => {
    try {
      setDaySlots(await api.daySlots(key));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      const rules = await api.availabilityRules();
      const next = emptyWeekForm();
      for (const rule of rules) {
        next[rule.weekday] = { enabled: true, startHour: rule.startHour, endHour: rule.endHour };
      }
      setWeek(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    loadDay(selectedKey);
  }, [selectedKey, loadDay]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMonth(), loadDay(selectedKey)]);
  }, [loadMonth, loadDay, selectedKey]);

  const markers = useMemo(() => {
    const map: Record<string, DayMarker> = {};
    // Gray out non-working weekdays across the whole visible month.
    const workingWeekdays = new Set(
      week.map((row, weekday) => (row.enabled ? weekday : -1)).filter((weekday) => weekday >= 0),
    );
    for (const cell of buildMonthGrid(viewDate)) {
      const weekday = jsWeekdayToMonday0(parseDateKey(cell.key).getDay());
      if (!workingWeekdays.has(weekday)) {
        (map[cell.key] ??= {}).unavailable = true;
      }
    }
    for (const c of consultations) {
      const entry = (map[c.date] ??= {});
      if (c.status === "approved") entry.approved = (entry.approved ?? 0) + 1;
      if (c.status === "pending") entry.pending = (entry.pending ?? 0) + 1;
    }
    for (const b of blocks) {
      const entry = (map[b.date] ??= {});
      entry.blocked = true;
      // A whole-day block makes the day unavailable too.
      if (b.startHour == null) entry.unavailable = true;
    }
    return map;
  }, [consultations, blocks, week, viewDate]);

  const pendingRequests = useMemo(
    () =>
      consultations
        .filter((c) => c.status === "pending")
        .sort((a, b) => (a.date + String(a.startHour).padStart(2, "0")).localeCompare(b.date + String(b.startHour).padStart(2, "0"))),
    [consultations],
  );

  const dayConsultations = useMemo(
    () =>
      consultations
        .filter((c) => c.date === selectedKey && c.status !== "rejected")
        .sort((a, b) => a.startHour - b.startHour),
    [consultations, selectedKey],
  );

  async function withRefresh(action: () => Promise<unknown>, successMessage: string) {
    setError("");
    setMessage("");
    try {
      await action();
      await refreshAll();
      setMessage(successMessage);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveAvailability() {
    const rules = week
      .map((row, weekday) => ({ weekday, ...row }))
      .filter((row) => row.enabled)
      .map((row) => {
        if (row.endHour <= row.startHour) {
          throw new Error(`${weekdayLabels[row.weekday]}요일: 종료 시간이 시작 시간보다 커야 합니다.`);
        }
        return { weekday: row.weekday, startHour: row.startHour, endHour: row.endHour };
      });
    await api.saveAvailabilityRules(rules);
    await loadAvailability();
    await refreshAll();
  }

  async function addBlock() {
    await api.createConsultationBlock({
      date: selectedKey,
      startHour: blockWholeDay ? null : blockStart,
      endHour: blockWholeDay ? null : blockEnd,
      reason: blockReason || undefined,
    });
    setBlockReason("");
  }

  const dayBlocks = blocks.filter((b) => b.date === selectedKey);

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">상담 모듈</div>
        <h1>상담 캘린더 관리</h1>
        <p className="lead">
          학생 상담 예약을 승인하고, 근무 요일과 시간대를 설정하며, 특정 날짜·시간을 차단합니다. 근무일로
          설정하지 않은 요일(예: 화·수)은 기본적으로 예약이 막혀 있습니다.
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <section className="consult-layout">
        <div className="panel">
          <MonthCalendar
            viewDate={viewDate}
            selectedKey={selectedKey}
            markers={markers}
            onPrevMonth={() => setViewDate((d) => addMonths(d, -1))}
            onNextMonth={() => setViewDate((d) => addMonths(d, 1))}
            onSelectDay={setSelectedKey}
          />
          <div className="calendar-legend">
            <span><span className="dot approved" /> 승인됨</span>
            <span><span className="dot pending" /> 승인 대기</span>
            <span><span className="dot blocked" /> 차단</span>
            <span><span className="legend-swatch off" /> 상담 불가(휴무)</span>
          </div>
        </div>

        <div className="panel">
          <h2>{formatDateKorean(selectedKey)}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {daySlots?.workingDay ? "근무일" : "근무일 아님 (예약 불가 · 기본 차단)"}
          </p>

          <div className="slot-grid">
            {daySlots?.slots.map((slot) => {
              const consult = dayConsultations.find(
                (c) => slot.hour >= c.startHour && slot.hour < c.endHour,
              );
              return (
                <div key={slot.hour} className={`slot slot-${slot.state}`}>
                  <div className="slot-time">{formatHourRange(slot.hour, slot.hour + 1)}</div>
                  <div className="slot-label">
                    {slot.state === "available" && "예약 가능"}
                    {slot.state === "unavailable" && "근무 외"}
                    {slot.state === "blocked" && (slot.reason ? `차단: ${slot.reason}` : "차단됨")}
                    {slot.state === "past" && "지남"}
                    {(slot.state === "pending" || slot.state === "approved") && consult && (
                      <span>
                        {consultationStatusLabel[slot.state]} · {consult.studentId}
                      </span>
                    )}
                  </div>
                  {consult ? (
                    <div className="slot-actions">
                      {consult.status === "pending" ? (
                        <button
                          type="button"
                          className="button compact"
                          onClick={() => withRefresh(() => api.approveConsultation(consult.id), "상담을 승인했습니다.")}
                        >
                          승인
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="button secondary compact"
                        onClick={() =>
                          withRefresh(
                            () => api.rejectConsultation(consult.id),
                            consult.status === "approved" ? "상담을 취소했습니다." : "상담을 거절했습니다.",
                          )
                        }
                      >
                        {consult.status === "approved" ? "취소" : "거절"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="block-form">
            <h3>이 날짜 차단하기</h3>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={blockWholeDay}
                onChange={(e) => setBlockWholeDay(e.target.checked)}
              />
              하루 종일 차단
            </label>
            {!blockWholeDay ? (
              <div className="hour-range">
                <select value={blockStart} onChange={(e) => setBlockStart(Number(e.target.value))}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
                <span>~</span>
                <select value={blockEnd} onChange={(e) => setBlockEnd(Number(e.target.value))}>
                  {HOURS.map((h) => h + 1).map((h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <input
              placeholder="차단 사유 (선택)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
            <button
              type="button"
              className="button"
              onClick={() => withRefresh(addBlock, "차단을 추가했습니다.")}
            >
              차단 추가
            </button>

            {dayBlocks.length > 0 ? (
              <ul className="block-list">
                {dayBlocks.map((b) => (
                  <li key={b.id}>
                    <span>
                      {b.startHour == null
                        ? "하루 종일"
                        : formatHourRange(b.startHour, b.endHour ?? b.startHour + 1)}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </span>
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() => withRefresh(() => api.deleteConsultationBlock(b.id), "차단을 해제했습니다.")}
                    >
                      해제
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>승인 대기 요청</h2>
        {pendingRequests.length === 0 ? (
          <p className="muted">이번 달에 승인 대기 중인 요청이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>시간</th>
                  <th>학번</th>
                  <th>사유</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateKorean(c.date)}</td>
                    <td>{formatHourRange(c.startHour, c.endHour)}</td>
                    <td>
                      {c.studentId}
                      {c.studentName ? ` (${c.studentName})` : ""}
                    </td>
                    <td>{c.reason || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button compact"
                          onClick={() => withRefresh(() => api.approveConsultation(c.id), "상담을 승인했습니다.")}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className="button secondary compact"
                          onClick={() => withRefresh(() => api.rejectConsultation(c.id), "상담을 거절했습니다.")}
                        >
                          거절
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>근무 요일 설정</h2>
        <p className="muted">체크한 요일만 상담 예약이 열립니다. 체크하지 않은 요일은 자동으로 차단됩니다.</p>
        <div className="week-grid">
          {week.map((row, weekday) => (
            <div key={weekday} className={`week-row ${row.enabled ? "on" : ""}`}>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) =>
                    setWeek((prev) =>
                      prev.map((r, i) => (i === weekday ? { ...r, enabled: e.target.checked } : r)),
                    )
                  }
                />
                {weekdayLabels[weekday]}요일
              </label>
              <div className="hour-range">
                <select
                  value={row.startHour}
                  disabled={!row.enabled}
                  onChange={(e) =>
                    setWeek((prev) =>
                      prev.map((r, i) => (i === weekday ? { ...r, startHour: Number(e.target.value) } : r)),
                    )
                  }
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
                <span>~</span>
                <select
                  value={row.endHour}
                  disabled={!row.enabled}
                  onChange={(e) =>
                    setWeek((prev) =>
                      prev.map((r, i) => (i === weekday ? { ...r, endHour: Number(e.target.value) } : r)),
                    )
                  }
                >
                  {HOURS.map((h) => h + 1).map((h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="button" onClick={() => withRefresh(saveAvailability, "근무 요일 설정을 저장했습니다.")}>
            설정 저장
          </button>
        </div>
      </section>
    </>
  );
}
