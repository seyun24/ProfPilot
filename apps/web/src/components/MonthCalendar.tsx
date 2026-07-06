"use client";

import { buildMonthGrid } from "@/lib/calendar";
import { weekdayLabels } from "@/lib/labels";

export type DayMarker = {
  approved?: number;
  pending?: number;
  blocked?: boolean;
  unavailable?: boolean;
};

type Props = {
  viewDate: Date;
  selectedKey: string | null;
  markers?: Record<string, DayMarker>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (key: string) => void;
};

export default function MonthCalendar({
  viewDate,
  selectedKey,
  markers = {},
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: Props) {
  const cells = buildMonthGrid(viewDate);
  const title = `${viewDate.getFullYear()}년 ${viewDate.getMonth() + 1}월`;

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="button secondary compact" onClick={onPrevMonth} aria-label="이전 달">
          ‹
        </button>
        <div className="calendar-title">{title}</div>
        <button type="button" className="button secondary compact" onClick={onNextMonth} aria-label="다음 달">
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekdayLabels.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell) => {
          const marker = markers[cell.key];
          const classNames = ["calendar-cell"];
          if (!cell.inCurrentMonth) classNames.push("outside");
          if (marker?.unavailable) classNames.push("unavailable");
          if (cell.isToday) classNames.push("today");
          if (cell.key === selectedKey) classNames.push("selected");
          if (cell.isPast) classNames.push("past");
          return (
            <button
              type="button"
              key={cell.key}
              className={classNames.join(" ")}
              onClick={() => onSelectDay(cell.key)}
            >
              <span className="calendar-day-num">{cell.day}</span>
              <span className="calendar-day-marks">
                {marker?.approved ? <span className="dot approved" title="승인된 상담" /> : null}
                {marker?.pending ? <span className="dot pending" title="승인 대기" /> : null}
                {marker?.blocked ? <span className="dot blocked" title="차단됨" /> : null}
                {marker?.unavailable && !marker?.approved && !marker?.pending ? (
                  <span className="calendar-day-off">휴무</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
