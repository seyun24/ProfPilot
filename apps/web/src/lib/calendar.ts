// Calendar helpers. All date<->string conversions use LOCAL time components so
// a booked slot never drifts by a day across timezones (unlike Date.toISOString).

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export type CalendarCell = {
  key: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
};

// Build a 6-row (42 cell) month grid starting on Monday.
export function buildMonthGrid(viewDate: Date): CalendarCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay: Sunday=0 ... Saturday=6. Shift so Monday is the first column.
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leading);

  const todayStr = todayKey();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = toDateKey(cellDate);
    cells.push({
      key,
      day: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === month,
      isToday: key === todayStr,
      isPast: key < todayStr,
    });
  }
  return cells;
}

export function formatHourRange(startHour: number, endHour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(startHour)}:00 ~ ${pad(endHour)}:00`;
}

export function formatDateKorean(key: string): string {
  const date = parseDateKey(key);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}
