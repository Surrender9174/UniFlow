export type RelativeDeadline =
  | { daysFromToday: number; time: string }
  | { weekday: number; time: string };

export function getWeekDates(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);

  return Array.from(
    { length: 7 },
    (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
  );
}

export function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", { weekday: "short" })
    .format(date)
    .replace(/\.$/, "")
    .toLocaleUpperCase("ro-RO");
}

export function formatWeekRange(date: Date) {
  const [start, , , , , , end] = getWeekDates(date);
  const startMonth = new Intl.DateTimeFormat("ro-RO", { month: "short" }).format(start);
  const endMonth = new Intl.DateTimeFormat("ro-RO", { month: "short" }).format(end);

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} — ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }

  return `${start.getDate()} ${startMonth} — ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

export function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatLocalTime(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getIsoWeekNumber(date: Date) {
  const isoDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = isoDate.getUTCDay() || 7;
  isoDate.setUTCDate(isoDate.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(isoDate.getUTCFullYear(), 0, 1));

  return Math.ceil(((isoDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function getAcademicYearLabel(date: Date) {
  const startYear = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}–${startYear + 1}`;
}

export function getDeadlineDate(now: Date, deadline: RelativeDeadline) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if ("daysFromToday" in deadline) {
    date.setDate(date.getDate() + deadline.daysFromToday);
  } else {
    date.setDate(date.getDate() + (deadline.weekday - date.getDay() + 7) % 7);
  }

  return date;
}

export function formatRelativeDeadline(now: Date, deadline: RelativeDeadline) {
  const date = getDeadlineDate(now, deadline);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const daysUntil = Math.round((dueDay - today) / 86_400_000);
  const weekday = new Intl.DateTimeFormat("ro-RO", { weekday: "long" }).format(date);
  const label = daysUntil === 0
    ? "Astăzi"
    : daysUntil === 1
      ? "Mâine"
      : `${weekday[0].toLocaleUpperCase("ro-RO")}${weekday.slice(1)}`;

  return `${label} · ${deadline.time}`;
}

export function formatMonthAbbreviation(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", { month: "short" })
    .format(date)
    .replace(/\.$/, "")
    .toLocaleUpperCase("ro-RO");
}
