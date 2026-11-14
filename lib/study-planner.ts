import type { ScheduleEvent } from "./schedule-storage";
import type { SavedTask } from "./tasks";

export type StudyPlanInput = {
  subject: string;
  examDate: string;
  topics: string[];
  confidence: number;
  studyStart: string;
  studyEnd: string;
};

export type PlannedStudyTask = {
  title: string;
  subject: string;
  dueAt: string;
  category: "Studiu";
  topic: string;
};

type StudySlot = {
  startsAt: Date;
  dayOffset: number;
  dayKey: string;
};

type PlannedTopicSession = {
  topic: string;
  topicIndex: number;
  repetition: number;
  repetitionCount: number;
  targetDay: number;
};

const sessionMinutes = 30;
const maxSessionsPerDay = 4;
const maxTopics = 12;

function parseClock(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOffset(from: Date, to: Date) {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function eventMinutes(value: string) {
  const minutes = parseClock(value);
  if (minutes === null) {
    throw new Error("Orarul conține o oră invalidă. Verifică și salvează din nou orarul.");
  }
  return minutes;
}

function getRepetitionOffsets(repetitionCount: number, daysUntilExam: number) {
  const ratios = repetitionCount === 1
    ? [0.7]
    : repetitionCount === 2
      ? [0.2, 0.7]
      : [0.08, 0.45, 0.82];
  return ratios.map((ratio) =>
    Math.min(daysUntilExam - 1, Math.floor(ratio * daysUntilExam)),
  );
}

function hasScheduleConflict(
  date: Date,
  startMinute: number,
  schedule: ScheduleEvent[],
) {
  const endMinute = startMinute + sessionMinutes;
  return schedule.some((event) => {
    if (event.weekday !== date.getDay()) return false;
    const classStart = eventMinutes(event.start);
    const classEnd = eventMinutes(event.end);
    return startMinute < classEnd && endMinute > classStart;
  });
}

function hasDeadlineConflict(startsAt: Date, tasks: SavedTask[]) {
  const startsAtMs = startsAt.getTime();
  const bufferBefore = 30 * 60_000;
  const bufferAfter = 60 * 60_000;
  return tasks.some((task) => {
    if (task.done || !task.dueAt) return false;
    const deadline = Date.parse(task.dueAt);
    return deadline >= startsAtMs - bufferBefore &&
      deadline < startsAtMs + bufferAfter;
  });
}

function buildAvailableSlots(
  startDate: Date,
  daysUntilExam: number,
  studyStart: number,
  studyEnd: number,
  schedule: ScheduleEvent[],
  tasks: SavedTask[],
  now: Date,
) {
  const slots: StudySlot[] = [];
  for (let dayOffset = 0; dayOffset < daysUntilExam; dayOffset += 1) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + dayOffset,
    );
    for (
      let startMinute = studyStart;
      startMinute + sessionMinutes <= studyEnd;
      startMinute += sessionMinutes
    ) {
      if (dayOffset === 0) {
        const startsAt = new Date(date);
        startsAt.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
        if (startsAt.getTime() < now.getTime() + 15 * 60_000) continue;
        if (hasScheduleConflict(date, startMinute, schedule)) continue;
        if (hasDeadlineConflict(startsAt, tasks)) continue;
        slots.push({ startsAt, dayOffset, dayKey: dayKey(date) });
        continue;
      }

      if (hasScheduleConflict(date, startMinute, schedule)) continue;
      const startsAt = new Date(date);
      startsAt.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
      if (hasDeadlineConflict(startsAt, tasks)) continue;
      slots.push({ startsAt, dayOffset, dayKey: dayKey(date) });
    }
  }
  return slots;
}

export function generateStudyPlanTasks(
  input: StudyPlanInput,
  schedule: ScheduleEvent[],
  tasks: SavedTask[],
  now: Date,
): PlannedStudyTask[] {
  const subject = input.subject.trim();
  const topics = input.topics.map((topic) => topic.trim()).filter(Boolean);
  const examDate = parseDate(input.examDate);
  const studyStart = parseClock(input.studyStart);
  const studyEnd = parseClock(input.studyEnd);

  if (!subject || subject.length > 80) {
    throw new Error("Completează materia sau cursul (maximum 80 de caractere).");
  }
  if (!examDate || dateOffset(now, examDate) < 1) {
    throw new Error("Alege o dată de examen de cel puțin o zi în viitor.");
  }
  if (dateOffset(now, examDate) > 180) {
    throw new Error("Alege o dată de examen în următoarele 180 de zile.");
  }
  if (topics.length === 0 || topics.length > maxTopics ||
    topics.some((topic) => topic.length < 2 || topic.length > 80)) {
    throw new Error(`Introdu între 1 și ${maxTopics} teme, fiecare de 2–80 de caractere.`);
  }
  if (new Set(topics.map((topic) => topic.toLocaleLowerCase("ro-RO"))).size !== topics.length) {
    throw new Error("Elimină temele duplicate din listă.");
  }
  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 5) {
    throw new Error("Alege un nivel de încredere de la 1 la 5.");
  }
  if (
    studyStart === null ||
    studyEnd === null ||
    studyEnd - studyStart < sessionMinutes
  ) {
    throw new Error("Alege un interval zilnic de cel puțin 30 de minute.");
  }

  const daysUntilExam = dateOffset(now, examDate);
  const repetitionCount = Math.min(
    input.confidence <= 2 ? 3 : input.confidence === 3 ? 2 : 1,
    daysUntilExam,
  );
  const repetitionOffsets = getRepetitionOffsets(repetitionCount, daysUntilExam);
  const plannedSessions: PlannedTopicSession[] = topics.flatMap((topic, topicIndex) =>
    repetitionOffsets.map((targetDay, repetition) => ({
      topic,
      topicIndex,
      repetition,
      repetitionCount,
      targetDay,
    })),
  ).sort((left, right) =>
    left.targetDay - right.targetDay ||
    left.repetition - right.repetition ||
    left.topicIndex - right.topicIndex,
  );
  const slots = buildAvailableSlots(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    daysUntilExam,
    studyStart,
    studyEnd,
    schedule,
    tasks,
    now,
  );
  const usedSlots = new Set<number>();
  const dailySessionCounts = new Map<string, number>();
  const lastSessionDayByTopic = new Map<number, number>();
  const allocated: Array<{ session: PlannedTopicSession; slot: StudySlot }> = [];

  for (const session of plannedSessions) {
    const lastTopicDay = lastSessionDayByTopic.get(session.topicIndex) ?? -1;
    const minimumDay = Math.max(session.targetDay, lastTopicDay + 1);
    const canUse = (slot: StudySlot) =>
      !usedSlots.has(slot.startsAt.getTime()) &&
      (dailySessionCounts.get(slot.dayKey) ?? 0) < maxSessionsPerDay &&
      slot.dayOffset >= lastTopicDay + 1;
    const slot = slots.find((candidate) =>
      candidate.dayOffset >= minimumDay && canUse(candidate),
    ) ?? slots.find((candidate) =>
      candidate.dayOffset < session.targetDay && canUse(candidate),
    );

    if (!slot) {
      throw new Error(
        "Nu sunt suficiente intervale libere înainte de examen. Extinde orele zilnice, redu numărul de teme sau alege o dată mai îndepărtată.",
      );
    }

    usedSlots.add(slot.startsAt.getTime());
    dailySessionCounts.set(slot.dayKey, (dailySessionCounts.get(slot.dayKey) ?? 0) + 1);
    lastSessionDayByTopic.set(session.topicIndex, slot.dayOffset);
    allocated.push({ session, slot });
  }

  return allocated.map(({ session, slot }) => {
    const title = session.repetitionCount === 1
      ? `Recapitulare activă: ${session.topic}`
      : session.repetition === 0
        ? `Învățare: ${session.topic}`
        : session.repetition === session.repetitionCount - 1
          ? `Recapitulare activă: ${session.topic}`
          : `Repetare: ${session.topic}`;
    return {
      title,
      subject,
      dueAt: slot.startsAt.toISOString(),
      category: "Studiu" as const,
      topic: session.topic,
    };
  });
}
