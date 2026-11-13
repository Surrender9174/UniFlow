import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  readJsonBody,
} from "@/lib/skillswap/server";
import { parseSkillSwapProfile } from "@/lib/skillswap/validation";

export async function GET(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  try {
    const { client, userId } = result.auth;
    const [profileResult, skillsResult, availabilityResult, verificationsResult] = await Promise.all([
      client
        .from("skillswap_profiles")
        .select("display_name,bio,timezone")
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("skillswap_skills")
        .select("id,direction,name,skill_key,category,level")
        .eq("user_id", userId)
        .order("created_at"),
      client
        .from("skillswap_availability")
        .select("id,weekday,start_minute,end_minute")
        .eq("user_id", userId)
        .order("weekday")
        .order("start_minute"),
      client
        .from("skillswap_verifications")
        .select("skill_id")
        .eq("user_id", userId)
        .eq("status", "approved"),
    ]);
    const error = profileResult.error ?? skillsResult.error ??
      availabilityResult.error ?? verificationsResult.error;
    if (error) return databaseErrorResponse(error, "Nu am putut încărca profilul SkillSwap.");

    const profile = profileResult.data;
    const verifiedSkillIds = new Set(
      (verificationsResult.data ?? []).map((verification) => verification.skill_id),
    );
    return Response.json({
      profile: profile
        ? {
            displayName: profile.display_name,
            bio: profile.bio,
            timezone: profile.timezone,
            skills: (skillsResult.data ?? []).map((skill) => ({
              id: skill.id,
              direction: skill.direction,
              name: skill.name,
              skillKey: skill.skill_key,
              category: skill.category,
              level: skill.level,
            })),
            availability: (availabilityResult.data ?? []).map((slot) => ({
              id: slot.id,
              weekday: slot.weekday,
              startMinute: slot.start_minute,
              endMinute: slot.end_minute,
            })),
            verifiedSkills: (skillsResult.data ?? [])
              .filter((skill) => verifiedSkillIds.has(skill.id))
              .map((skill) => skill.skill_key),
          }
        : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca profilul SkillSwap.");
  }
}

export async function PUT(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const profile = parseSkillSwapProfile(await readJsonBody(request));
  if (!profile) {
    return Response.json({ error: "Verifică numele, abilitățile și intervalele de disponibilitate." }, {
      status: 400,
    });
  }

  try {
    const { error } = await result.auth.client.rpc("skillswap_save_profile", {
      p_display_name: profile.displayName,
      p_bio: profile.bio,
      p_timezone: profile.timezone,
      p_skills: profile.skills.map(({ direction, name, category, level }) => ({
        direction,
        name,
        category,
        level,
      })),
      p_availability: profile.availability.map(({ weekday, startMinute, endMinute }) => ({
        weekday,
        start_minute: startMinute,
        end_minute: endMinute,
      })),
    });
    if (error) return databaseErrorResponse(error, "Nu am putut salva profilul SkillSwap.");
    return Response.json({ saved: true });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut salva profilul SkillSwap.");
  }
}
