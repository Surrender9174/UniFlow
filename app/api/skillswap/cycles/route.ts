import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  isRecord,
  isUuid,
  readJsonBody,
} from "@/lib/skillswap/server";
import { normalizeSkillKey, parseSessionStart } from "@/lib/skillswap/validation";

export async function POST(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const body: unknown = await readJsonBody(request);
  if (!isRecord(body) || !Array.isArray(body.legs) || body.legs.length !== 3) {
    return Response.json({ error: "Un schimb circular are nevoie de trei participanți." }, {
      status: 400,
    });
  }
  const startsAt = parseSessionStart(body.startsAt);
  if (!startsAt) {
    return Response.json({ error: "Alege o dată și o oră valide." }, { status: 400 });
  }

  const legs = [];
  for (const leg of body.legs) {
    if (!isRecord(leg) || !isUuid(leg.teacherId) || !isUuid(leg.learnerId)) {
      return Response.json({ error: "Schimbul circular conține un participant invalid." }, {
        status: 400,
      });
    }
    const skill = normalizeSkillKey(leg.skill);
    if (!skill || leg.teacherId === leg.learnerId) {
      return Response.json({ error: "Schimbul circular conține o abilitate invalidă." }, {
        status: 400,
      });
    }
    legs.push({
      teacher_id: leg.teacherId,
      learner_id: leg.learnerId,
      skill,
    });
  }

  try {
    const { data: cycleId, error } = await result.auth.client.rpc(
      "skillswap_create_cycle",
      { p_legs: legs, p_starts_at: startsAt },
    );
    if (error) return databaseErrorResponse(error, "Nu am putut crea schimbul circular.");
    return Response.json({ cycleId }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut crea schimbul circular.");
  }
}
