import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  isRecord,
  isUuid,
  readJsonBody,
} from "@/lib/skillswap/server";

export async function GET(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  try {
    const { data, error } = await result.auth.client
      .from("skillswap_verifications")
      .select("id,user_id,skill_id,submission_type,evidence,status,reviewer_id,review_note,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return databaseErrorResponse(error, "Nu am putut încărca verificările.");

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((item) => item.user_id))];
    const skillIds = [...new Set(rows.map((item) => item.skill_id))];
    const [profilesResult, skillsResult] = await Promise.all([
      userIds.length
        ? result.auth.client
            .from("skillswap_profiles")
            .select("user_id,display_name")
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      skillIds.length
        ? result.auth.client
            .from("skillswap_skills")
            .select("id,name")
            .in("id", skillIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const queryError = profilesResult.error ?? skillsResult.error;
    if (queryError) return databaseErrorResponse(queryError, "Nu am putut încărca verificările.");

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]));
    const skills = new Map((skillsResult.data ?? []).map((skill) => [skill.id, skill.name]));
    return Response.json({
      submissions: rows.map((item) => ({
        ...item,
        displayName: profiles.get(item.user_id) ?? "Membru SkillSwap",
        skillName: skills.get(item.skill_id) ?? "Abilitate",
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca verificările.");
  }
}

export async function POST(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;
  const body: unknown = await readJsonBody(request);
  if (
    !isRecord(body) ||
    !isUuid(body.skillId) ||
    (body.submissionType !== "quiz" && body.submissionType !== "portfolio") ||
    typeof body.evidence !== "string" ||
    body.evidence.trim().length < 10 ||
    body.evidence.trim().length > 1200
  ) {
    return Response.json({ error: "Completează tipul verificării și dovada (10–1200 caractere)." }, {
      status: 400,
    });
  }

  try {
    const { data, error } = await result.auth.client.rpc("skillswap_submit_verification", {
      p_skill_id: body.skillId,
      p_submission_type: body.submissionType,
      p_evidence: body.evidence.trim(),
    });
    if (error) return databaseErrorResponse(error, "Nu am putut trimite verificarea.");
    return Response.json({ verificationId: data }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut trimite verificarea.");
  }
}
