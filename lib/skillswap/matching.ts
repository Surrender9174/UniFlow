import type {
  AvailabilitySlot,
  CycleLeg,
  CycleMatch,
  DirectMatch,
  MatchRecommendation,
  PublicSkillSwapProfile,
} from "@/lib/skillswap/types";

const dayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type LocalDateParts = { year: number; month: number; day: number };

function getLocalDateParts(date: Date, timezone: string): LocalDateParts & { weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: dayIndexes[values.weekday],
  };
}

function shiftDate(parts: LocalDateParts, days: number): LocalDateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function localDateTimeToUtc(
  date: LocalDateParts,
  minuteOfDay: number,
  timezone: string,
) {
  const targetDate = shiftDate(date, Math.floor(minuteOfDay / 1440));
  const adjustedMinute = minuteOfDay % 1440;
  const targetWallTime = Date.UTC(
    targetDate.year,
    targetDate.month - 1,
    targetDate.day,
    Math.floor(adjustedMinute / 60),
    adjustedMinute % 60,
  );
  let guess = targetWallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = getLocalDateParts(new Date(guess), timezone);
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const timeValues = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
    const localWallTime = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      Number(timeValues.hour),
      Number(timeValues.minute),
    );
    guess += targetWallTime - localWallTime;
  }

  return new Date(guess);
}

function getOffsetMinutes(date: Date, timezone: string) {
  const local = getLocalDateParts(date, timezone);
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const timeValues = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    Number(timeValues.hour),
    Number(timeValues.minute),
  );
  return Math.round((localAsUtc - date.getTime()) / 60_000);
}

function occurrences(
  slots: AvailabilitySlot[],
  timezone: string,
  now: Date,
  days = 21,
) {
  const results: Array<{ start: number; end: number }> = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const reference = new Date(now.getTime() + dayOffset * 86_400_000);
    const localDate = getLocalDateParts(reference, timezone);
    for (const slot of slots) {
      if (slot.weekday !== localDate.weekday) continue;
      results.push({
        start: localDateTimeToUtc(localDate, slot.startMinute, timezone).getTime(),
        end: localDateTimeToUtc(localDate, slot.endMinute, timezone).getTime(),
      });
    }
  }
  return results;
}

export function findCommonSlots(
  firstSlots: AvailabilitySlot[],
  firstTimezone: string,
  secondSlots: AvailabilitySlot[],
  secondTimezone: string,
  now = new Date(),
  limit = 3,
) {
  const first = occurrences(firstSlots, firstTimezone, now);
  const second = occurrences(secondSlots, secondTimezone, now);
  const earliest = now.getTime() + 15 * 60_000;
  const candidates = new Set<number>();

  for (const firstOccurrence of first) {
    for (const secondOccurrence of second) {
      const overlapStart = Math.max(firstOccurrence.start, secondOccurrence.start, earliest);
      const overlapEnd = Math.min(firstOccurrence.end, secondOccurrence.end);
      const roundedStart = Math.ceil(overlapStart / (15 * 60_000)) * 15 * 60_000;
      if (roundedStart + 60 * 60_000 <= overlapEnd) candidates.add(roundedStart);
    }
  }

  return [...candidates]
    .sort((left, right) => left - right)
    .slice(0, limit)
    .map((timestamp) => new Date(timestamp).toISOString());
}

function skillByKey(
  profile: PublicSkillSwapProfile,
  direction: "offered" | "wanted",
) {
  return new Map(
    profile.skills
      .filter((skill) => skill.direction === direction)
      .map((skill) => [skill.skillKey, skill]),
  );
}

function edgeScore(
  learner: PublicSkillSwapProfile,
  teacher: PublicSkillSwapProfile,
  now: Date,
) {
  const wanted = skillByKey(learner, "wanted");
  const offered = skillByKey(teacher, "offered");
  const skillKey = [...wanted.keys()].find((key) => offered.has(key));
  if (!skillKey) return null;

  const nextSlots = findCommonSlots(
    learner.availability,
    learner.timezone,
    teacher.availability,
    teacher.timezone,
    now,
  );
  const timezoneGap = Math.abs(
    getOffsetMinutes(now, learner.timezone) - getOffsetMinutes(now, teacher.timezone),
  ) / 60;
  const timezoneScore = Math.max(0, 100 - timezoneGap * 8);
  const availabilityScore = nextSlots.length > 0 ? 100 : 25;
  const ratingScore = teacher.ratingCount > 0 ? teacher.rating * 20 : 70;
  const verifiedBonus = teacher.verifiedSkills.includes(skillKey) ? 5 : 0;
  const score = Math.min(
    100,
    Math.round(0.6 * 100 + 0.18 * availabilityScore + 0.12 * timezoneScore + 0.1 * ratingScore + verifiedBonus),
  );
  return {
    skill: wanted.get(skillKey)?.name ?? offered.get(skillKey)?.name ?? skillKey,
    nextSlots,
    score,
  };
}

function pairScore(
  learner: PublicSkillSwapProfile,
  teacher: PublicSkillSwapProfile,
  now: Date,
) {
  const learns = edgeScore(learner, teacher, now);
  const teaches = edgeScore(teacher, learner, now);
  if (!learns || !teaches) return null;
  return {
    learns: learns.skill,
    teaches: teaches.skill,
    nextSlots: learns.nextSlots,
    score: Math.round((learns.score + teaches.score) / 2),
  };
}

export function buildRecommendations(
  currentUser: PublicSkillSwapProfile,
  profiles: PublicSkillSwapProfile[],
  now = new Date(),
): MatchRecommendation[] {
  const others = profiles.filter((profile) => profile.userId !== currentUser.userId);
  const direct: DirectMatch[] = [];

  for (const partner of others) {
    const match = pairScore(currentUser, partner, now);
    if (!match) continue;
    direct.push({
      kind: "direct",
      score: match.score,
      partner,
      teachesSkill: match.teaches,
      learnsSkill: match.learns,
      nextSlots: match.nextSlots,
    });
  }
  direct.sort((left, right) => right.score - left.score);

  const cycles: CycleMatch[] = [];
  const seenCycles = new Set<string>();

  for (const firstPartner of others) {
    const firstEdge = edgeScore(currentUser, firstPartner, now);
    if (!firstEdge) continue;
    for (const secondPartner of others) {
      if (secondPartner.userId === firstPartner.userId) continue;
      const secondEdge = edgeScore(firstPartner, secondPartner, now);
      const thirdEdge = edgeScore(secondPartner, currentUser, now);
      if (!secondEdge || !thirdEdge) continue;

      const cycleKey = [currentUser.userId, firstPartner.userId, secondPartner.userId]
        .sort()
        .join(":");
      if (seenCycles.has(cycleKey)) continue;
      seenCycles.add(cycleKey);

      const legs: CycleLeg[] = [
        {
          teacherId: firstPartner.userId,
          learnerId: currentUser.userId,
          skill: firstEdge.skill,
          teacherName: firstPartner.displayName,
          learnerName: currentUser.displayName,
        },
        {
          teacherId: secondPartner.userId,
          learnerId: firstPartner.userId,
          skill: secondEdge.skill,
          teacherName: secondPartner.displayName,
          learnerName: firstPartner.displayName,
        },
        {
          teacherId: currentUser.userId,
          learnerId: secondPartner.userId,
          skill: thirdEdge.skill,
          teacherName: currentUser.displayName,
          learnerName: secondPartner.displayName,
        },
      ];
      const legScores = [
        firstEdge.score,
        secondEdge.score,
        thirdEdge.score,
      ];
      cycles.push({
        kind: "cycle",
        score: Math.round(legScores.reduce((sum, score) => sum + score, 0) / legScores.length),
        members: [currentUser, firstPartner, secondPartner],
        legs,
      });
    }
  }
  cycles.sort((left, right) => right.score - left.score);

  return [...direct.slice(0, 12), ...cycles.slice(0, 6)];
}
