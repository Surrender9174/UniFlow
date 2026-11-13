export const skillCategories = [
  "Programming",
  "Design",
  "Languages",
  "Business",
  "Music",
  "Other",
] as const;

export const skillLevels = ["Beginner", "Intermediate", "Expert"] as const;

export type SkillCategory = (typeof skillCategories)[number];
export type SkillLevel = (typeof skillLevels)[number];
export type SkillDirection = "offered" | "wanted";

export type SkillSwapSkill = {
  id: string;
  direction: SkillDirection;
  name: string;
  skillKey: string;
  category: SkillCategory;
  level: SkillLevel;
};

export type AvailabilitySlot = {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type SkillSwapProfile = {
  displayName: string;
  bio: string;
  timezone: string;
  skills: SkillSwapSkill[];
  availability: AvailabilitySlot[];
  verifiedSkills?: string[];
};

export type PublicSkillSwapProfile = SkillSwapProfile & {
  userId: string;
  rating: number;
  ratingCount: number;
  verifiedSkills: string[];
};

export type CycleLeg = {
  teacherId: string;
  learnerId: string;
  skill: string;
  teacherName: string;
  learnerName: string;
};

export type DirectMatch = {
  kind: "direct";
  score: number;
  partner: PublicSkillSwapProfile;
  teachesSkill: string;
  learnsSkill: string;
  nextSlots: string[];
};

export type CycleMatch = {
  kind: "cycle";
  score: number;
  members: PublicSkillSwapProfile[];
  legs: CycleLeg[];
};

export type MatchRecommendation = DirectMatch | CycleMatch;

export type SkillSwapSession = {
  id: string;
  cycle_id: string | null;
  teacher_id: string;
  learner_id: string;
  skill: string;
  starts_at: string;
  duration_minutes: number;
  status:
    | "requested"
    | "accepted"
    | "declined"
    | "cancelled"
    | "awaiting_confirmation"
    | "completed"
    | "disputed";
  teacher_confirmed_at: string | null;
  learner_confirmed_at: string | null;
  created_at: string;
  teacher_name?: string;
  learner_name?: string;
  reviewed_by_me?: boolean;
};
