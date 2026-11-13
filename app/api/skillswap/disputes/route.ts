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
      .from("skillswap_disputes")
      .select("id,session_id,opened_by,kind,reason,status,resolution,created_at,resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return databaseErrorResponse(error, "Nu am putut încărca sesizările.");
    return Response.json({ disputes: data ?? [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca sesizările.");
  }
}

export async function PATCH(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;
  const body: unknown = await readJsonBody(request);
  if (
    !isRecord(body) ||
    !isUuid(body.disputeId) ||
    typeof body.resolution !== "string" ||
    body.resolution.trim().length < 10 ||
    body.resolution.trim().length > 1200
  ) {
    return Response.json({ error: "Adaugă o rezoluție de cel puțin 10 caractere." }, {
      status: 400,
    });
  }

  try {
    const { error } = await result.auth.client.rpc("skillswap_resolve_dispute", {
      p_dispute_id: body.disputeId,
      p_resolution: body.resolution.trim(),
    });
    if (error) return databaseErrorResponse(error, "Nu am putut rezolva sesizarea.");
    return Response.json({ saved: true });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut rezolva sesizarea.");
  }
}
