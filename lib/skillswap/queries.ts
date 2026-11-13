import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicSkillSwapProfile, SkillSwapSkill } from "@/lib/skillswap/types";

type ProfileRow = {
  user_id: string;
  display_name: string;
  bio: string;
  timezone: string;
};

type SkillRow = {
  id: string;
  user_id: string;
  direction: "offered" | "wanted";
  name: string;
  skill_key: string;
  category: SkillSwapSkill["category"];
  level: SkillSwapSkill["level"];
};

type AvailabilityRow = {
  id: string;
  user_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export async function loadPublicSkillSwapProfiles(client: SupabaseClient) {
  const [profilesResult, skillsResult, availabilityResult, reviewsResult, verifiedResult] =
    await Promise.all([
      client
        .from("skillswap_profiles")
        .select("user_id,display_name,bio,timezone")
        .limit(500),
      client
        .from("skillswap_skills")
        .select("id,user_id,direction,name,skill_key,category,level")
        .limit(5000),
      client
        .from("skillswap_availability")
        .select("id,user_id,weekday,start_minute,end_minute")
        .limit(5000),
      client
        .from("skillswap_reviews")
        .select("reviewee_id,rating")
        .limit(10000),
      client
        .from("skillswap_verifications")
        .select("user_id,skill_id")
        .eq("status", "approved")
        .limit(5000),
    ]);

  const errors = [
    profilesResult.error,
    skillsResult.error,
    availabilityResult.error,
    reviewsResult.error,
    verifiedResult.error,
  ].filter(Boolean);
  if (errors.length > 0) throw errors[0];

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const skills = (skillsResult.data ?? []) as SkillRow[];
  const availability = (availabilityResult.data ?? []) as AvailabilityRow[];
  const reviews = reviewsResult.data ?? [];
  const verifications = verifiedResult.data ?? [];
  const skillKeysById = new Map(skills.map((skill) => [skill.id, skill.skill_key]));

  const ratings = new Map<string, { total: number; count: number }>();
  for (const review of reviews) {
    const current = ratings.get(review.reviewee_id) ?? { total: 0, count: 0 };
    current.total += review.rating;
    current.count += 1;
    ratings.set(review.reviewee_id, current);
  }

  const verifiedSkillKeys = new Map<string, Set<string>>();
  for (const verification of verifications) {
    const skillKey = skillKeysById.get(verification.skill_id);
    if (!skillKey) continue;
    const keys = verifiedSkillKeys.get(verification.user_id) ?? new Set<string>();
    keys.add(skillKey);
    verifiedSkillKeys.set(verification.user_id, keys);
  }

  return profiles.map((profile): PublicSkillSwapProfile => {
    const rating = ratings.get(profile.user_id);
    return {
      userId: profile.user_id,
      displayName: profile.display_name,
      bio: profile.bio,
      timezone: profile.timezone,
      skills: skills
        .filter((skill) => skill.user_id === profile.user_id)
        .map((skill) => ({
          id: skill.id,
          direction: skill.direction,
          name: skill.name,
          skillKey: skill.skill_key,
          category: skill.category,
          level: skill.level,
        })),
      availability: availability
        .filter((slot) => slot.user_id === profile.user_id)
        .map((slot) => ({
          id: slot.id,
          weekday: slot.weekday,
          startMinute: slot.start_minute,
          endMinute: slot.end_minute,
        })),
      rating: rating ? rating.total / rating.count : 0,
      ratingCount: rating?.count ?? 0,
      verifiedSkills: [...(verifiedSkillKeys.get(profile.user_id) ?? [])],
    };
  });
}
