import {
  skillCategories,
  skillLevels,
  type AvailabilitySlot,
  type SkillCategory,
  type SkillDirection,
  type SkillLevel,
  type SkillSwapProfile,
  type SkillSwapSkill,
} from "@/lib/skillswap/types";
import { isRecord } from "@/lib/skillswap/server";

export function parseSkillSwapProfile(value: unknown): SkillSwapProfile | null {
  if (!isRecord(value) || !Array.isArray(value.skills) || !Array.isArray(value.availability)) {
    return null;
  }

  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
  const bio = typeof value.bio === "string" ? value.bio.trim() : "";
  const timezone = typeof value.timezone === "string" ? value.timezone.trim() : "";
  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    bio.length > 400 ||
    timezone.length < 1 ||
    timezone.length > 64 ||
    value.skills.length > 20 ||
    value.availability.length > 21
  ) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return null;
  }

  const skills: SkillSwapSkill[] = [];
  const uniqueSkills = new Set<string>();
  for (const item of value.skills) {
    if (!isRecord(item)) return null;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const direction = item.direction;
    const category = item.category;
    const level = item.level;
    if (
      name.length < 2 ||
      name.length > 60 ||
      (direction !== "offered" && direction !== "wanted") ||
      !skillCategories.includes(category as SkillCategory) ||
      !skillLevels.includes(level as SkillLevel)
    ) {
      return null;
    }
    const skillKey = name.toLocaleLowerCase("en-US");
    const uniqueKey = `${direction}:${skillKey}`;
    if (uniqueSkills.has(uniqueKey)) return null;
    uniqueSkills.add(uniqueKey);
    skills.push({
      id: typeof item.id === "string" ? item.id : "",
      direction: direction as SkillDirection,
      name,
      skillKey,
      category: category as SkillCategory,
      level: level as SkillLevel,
    });
  }

  const availability: AvailabilitySlot[] = [];
  const uniqueSlots = new Set<string>();
  for (const item of value.availability) {
    if (!isRecord(item)) return null;
    const { weekday, startMinute, endMinute } = item;
    if (
      !Number.isInteger(weekday) ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute) ||
      Number(weekday) < 0 ||
      Number(weekday) > 6 ||
      Number(startMinute) < 0 ||
      Number(startMinute) > 1439 ||
      Number(endMinute) > 1440 ||
      Number(endMinute) - Number(startMinute) < 60
    ) {
      return null;
    }
    const uniqueKey = `${weekday}:${startMinute}:${endMinute}`;
    if (uniqueSlots.has(uniqueKey)) return null;
    uniqueSlots.add(uniqueKey);
    availability.push({
      weekday: Number(weekday),
      startMinute: Number(startMinute),
      endMinute: Number(endMinute),
    });
  }

  return { displayName, bio, timezone, skills, availability };
}

export function parseSessionStart(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeSkillKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}
