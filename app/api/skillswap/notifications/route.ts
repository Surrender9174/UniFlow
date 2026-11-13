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
      .from("skillswap_notifications")
      .select("id,session_id,type,message,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return databaseErrorResponse(error, "Nu am putut încărca notificările.");
    return Response.json({ notifications: data ?? [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca notificările.");
  }
}

export async function PATCH(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const body: unknown = await readJsonBody(request);
  if (!isRecord(body) || !isUuid(body.notificationId)) {
    return Response.json({ error: "Notificarea nu este validă." }, { status: 400 });
  }

  try {
    const { error } = await result.auth.client
      .from("skillswap_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.notificationId);
    if (error) return databaseErrorResponse(error, "Nu am putut marca notificarea ca citită.");
    return Response.json({ saved: true });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut marca notificarea ca citită.");
  }
}
