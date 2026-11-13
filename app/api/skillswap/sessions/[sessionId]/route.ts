import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  isRecord,
  isUuid,
  readJsonBody,
} from "@/lib/skillswap/server";
import type { SkillSwapSession } from "@/lib/skillswap/types";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) {
    return Response.json({ error: "Sesiunea nu a fost găsită." }, { status: 404 });
  }

  try {
    const { data: session, error } = await result.auth.client
      .from("skillswap_sessions")
      .select("id,cycle_id,teacher_id,learner_id,skill,starts_at,duration_minutes,status,teacher_confirmed_at,learner_confirmed_at,created_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return databaseErrorResponse(error, "Nu am putut încărca sesiunea.");
    if (!session) return Response.json({ error: "Sesiunea nu a fost găsită." }, { status: 404 });

    const row = session as SkillSwapSession;
    const { data: profiles, error: profilesError } = await result.auth.client
      .from("skillswap_profiles")
      .select("user_id,display_name")
      .in("user_id", [row.teacher_id, row.learner_id]);
    if (profilesError) {
      return databaseErrorResponse(profilesError, "Nu am putut încărca participanții sesiunii.");
    }
    const names = new Map((profiles ?? []).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]));
    return Response.json({
      session: {
        ...row,
        teacher_name: names.get(row.teacher_id) ?? "Membru SkillSwap",
        learner_name: names.get(row.learner_id) ?? "Membru SkillSwap",
      },
      currentUserId: result.auth.userId,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca sesiunea.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) {
    return Response.json({ error: "Sesiunea nu a fost găsită." }, { status: 404 });
  }
  const body: unknown = await readJsonBody(request);
  if (!isRecord(body) || typeof body.action !== "string") {
    return Response.json({ error: "Acțiunea este invalidă." }, { status: 400 });
  }

  try {
    const client = result.auth.client;
    if (["accept", "decline", "cancel"].includes(body.action)) {
      const { data, error } = await client.rpc("skillswap_respond_session", {
        p_session_id: sessionId,
        p_action: body.action,
      });
      if (error) return databaseErrorResponse(error, "Nu am putut actualiza sesiunea.");
      return Response.json({ session: data });
    }
    if (body.action === "confirm") {
      const { data, error } = await client.rpc("skillswap_confirm_session", {
        p_session_id: sessionId,
      });
      if (error) return databaseErrorResponse(error, "Nu am putut confirma sesiunea.");
      return Response.json({ session: data });
    }
    if (body.action === "finish") {
      const { data, error } = await client.rpc("skillswap_finish_session", {
        p_session_id: sessionId,
      });
      if (error) return databaseErrorResponse(error, "Nu am putut încheia sesiunea.");
      return Response.json({ session: data });
    }
    if (body.action === "dispute" || body.action === "no_show") {
      if (typeof body.reason !== "string" || body.reason.trim().length < 10 ||
        body.reason.trim().length > 1200) {
        return Response.json({ error: "Descrie situația în cel puțin 10 caractere." }, {
          status: 400,
        });
      }
      const { data, error } = await client.rpc("skillswap_open_dispute", {
        p_session_id: sessionId,
        p_kind: body.action,
        p_reason: body.reason.trim(),
      });
      if (error) return databaseErrorResponse(error, "Nu am putut trimite sesizarea.");
      return Response.json({ disputeId: data }, { status: 201 });
    }
    if (body.action === "review") {
      if (!Number.isInteger(body.rating) || Number(body.rating) < 1 ||
        Number(body.rating) > 5 || typeof body.comment !== "string" ||
        body.comment.length > 400) {
        return Response.json({ error: "Evaluarea trebuie să fie între 1 și 5." }, {
          status: 400,
        });
      }
      const { data, error } = await client.rpc("skillswap_review_session", {
        p_session_id: sessionId,
        p_rating: body.rating,
        p_comment: body.comment,
      });
      if (error) return databaseErrorResponse(error, "Nu am putut salva evaluarea.");
      return Response.json({ reviewId: data }, { status: 201 });
    }
    return Response.json({ error: "Acțiunea nu este acceptată." }, { status: 400 });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut actualiza sesiunea.");
  }
}
