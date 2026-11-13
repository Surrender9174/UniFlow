import type { ScheduleEvent } from "@/lib/schedule-storage";

const weekdays = [
  { index: 1, name: "Luni" },
  { index: 2, name: "Marți" },
  { index: 3, name: "Miercuri" },
  { index: 4, name: "Joi" },
  { index: 5, name: "Vineri" },
  { index: 6, name: "Sâmbătă" },
  { index: 0, name: "Duminică" },
];

const hasTimePattern = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i;
const roomPattern = /\b(?:sala\s*[\w.-]+|laborator(?:ul)?\s*\d+|lab\.?\s*\d+|amfiteatr(?:ul)?(?:\s+[\w.-]+){0,3}|corp\s+[a-z0-9]+)(?:\s*(?:·|,|-)\s*corp\s+[a-z0-9]+)?/i;
const typePattern = /\b(seminar(?:ul)?|laborator(?:ul)?|curs(?:ul)?|examen(?:ul)?|colocviu(?:l)?)\b/i;

function normalizeText(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("ro-RO");
}

function parseTime(hour: string, minute: string) {
  return `${hour.padStart(2, "0")}:${minute}`;
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getTimePattern() {
  return /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(?:-|–|—|pana la|la)\s*([01]?\d|2[0-3])[:.]([0-5]\d))?\b/gi;
}

function getDayPattern() {
  return /\b(luni|mar[tț]i|miercuri|joi|vineri|s[aă]mb[aă]t[aă]|duminic[aă])\b/gi;
}

function getWeekdays(line: string) {
  const normalized = normalizeText(line);
  return weekdays
    .filter((weekday) => new RegExp(`\\b${normalizeText(weekday.name)}\\b`, "i").test(normalized))
    .map((weekday) => weekday.index);
}

export function parseScheduleText(text: string): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim());
  let currentWeekday: number | null = null;
  let previousTextLine = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    const foundWeekdays = getWeekdays(line);
    if (foundWeekdays.length === 1) {
      currentWeekday = foundWeekdays[0];
      previousTextLine = "";
    }

    const timeMatches = [...line.matchAll(getTimePattern())];
    if (timeMatches.length === 0) {
      if (!foundWeekdays.length && currentWeekday !== null && line.length > 2) {
        previousTextLine = line;
      }
      continue;
    }

    const assignedWeekdays = foundWeekdays.length
      ? foundWeekdays
      : currentWeekday === null ? [] : [currentWeekday];
    if (!assignedWeekdays.length) continue;

    let sourceLine = line;
    let title = extractTitle(sourceLine);
    const previousCandidate = previousTextLine;
    previousTextLine = "";
    if (title.length < 2 && previousCandidate) {
      sourceLine = `${previousCandidate} ${line}`;
      title = extractTitle(sourceLine);
    }
    if (
      title.length < 2
      && lines[index + 1]
      && getWeekdays(lines[index + 1]).length === 0
      && !hasTimePattern.test(lines[index + 1])
    ) {
      sourceLine = `${line} ${lines[index + 1]}`;
      title = extractTitle(sourceLine);
      index += 1;
    }

    const type = sourceLine.match(typePattern)?.[1] ?? "Curs";
    const room = sourceLine.match(roomPattern)?.[0]?.trim() ?? "";

    if (title.length < 2) continue;

    timeMatches.forEach((match, timeIndex) => {
      const start = parseTime(match[1], match[2]);
      const end = match[3] && match[4]
        ? parseTime(match[3], match[4])
        : addMinutes(start, 90);
      const weekday = assignedWeekdays.length === 1
        ? assignedWeekdays[0]
        : assignedWeekdays[Math.min(timeIndex, assignedWeekdays.length - 1)];

      events.push({
        id: crypto.randomUUID(),
        weekday,
        start,
        end,
        title,
        type,
        room,
      });
    });
  }

  return events.sort((left, right) =>
    left.weekday - right.weekday || left.start.localeCompare(right.start),
  );
}

function extractTitle(line: string) {
  const roomMatch = line.match(roomPattern);
  const titleLine = roomMatch?.index === undefined ? line : line.slice(0, roomMatch.index);
  return titleLine
      .replace(getDayPattern(), " ")
      .replace(getTimePattern(), " ")
      .replace(typePattern, " ")
      .replace(/[|•·,;()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^(?:de|la)\s+/i, "");
}

export function getWeekdayName(index: number) {
  return weekdays.find((weekday) => weekday.index === index)?.name ?? "Zi necunoscută";
}
