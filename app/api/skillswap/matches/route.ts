import { buildRecommendations } from "@/lib/skillswap/matching";
import { loadPublicSkillSwapProfiles } from "@/lib/skillswap/queries";
import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
} from "@/lib/skillswap/server";

export async function GET(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  try {
    const profiles = await loadPublicSkillSwapProfiles(result.auth.client);
    const profile = profiles.find((item) => item.userId === result.auth?.userId);
    if (!profile) {
      return Response.json({ profileComplete: false, matches: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const matches = buildRecommendations(profile, profiles);
    return Response.json({ profileComplete: true, matches }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut calcula potrivirile SkillSwap.");
  }
}
