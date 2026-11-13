import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  isRecord,
  isUuid,
  readJsonBody,
} from "@/lib/skillswap/server";

export async function POST(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;
  const body: unknown = await readJsonBody(request);
  if (
    !isRecord(body) ||
    !isUuid(body.verificationId) ||
    typeof body.approved !== "boolean" ||
    typeof body.note !== "string" ||
    body.note.length > 400
  ) {
    return Response.json({ error: "Evaluarea verificării nu este validă." }, { status: 400 });
  }

  try {
    const { error } = await result.auth.client.rpc("skillswap_review_verification", {
      p_verification_id: body.verificationId,
      p_approved: body.approved,
      p_note: body.note.trim(),
    });
    if (error) return databaseErrorResponse(error, "Nu am putut trimite evaluarea.");
    return Response.json({ saved: true });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut trimite evaluarea.");
  }
}
