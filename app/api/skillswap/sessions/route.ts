import {
  authenticateSkillSwapRequest,
  databaseErrorResponse,
  isRecord,
  isUuid,
  readJsonBody,
} from "@/lib/skillswap/server";
import { normalizeSkillKey, parseSessionStart } from "@/lib/skillswap/validation";
import type { SkillSwapSession } from "@/lib/skillswap/types";

type SessionRow = SkillSwapSession & {
  teacher_id: string;
  learner_id: string;
};

const sessionCreationErrors: Record<string, string> = {
  "Invalid session participants.": "Nu poți trimite o propunere către propriul cont. Verifică partenerul selectat.",
  "Choose a valid future 60-minute session.": "Alege o oră cu cel puțin 15 minute în viitor și în următoarele 90 de zile.",
  "The selected skill is not a complementary match.": "Abilitatea aleasă nu mai corespunde profilurilor. Reîmprospătează pagina și încearcă din nou.",
  "Both participants must be available for the selected time.": "Ora aleasă trebuie să se încadreze în disponibilitatea amândurora pentru toate cele 60 de minute. Alege un interval comun sugerat.",
  "A participant already has a session at that time.": "Unul dintre participanți are deja o sesiune suprapusă la acea oră.",
};

export async function GET(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  try {
    const { client, userId } = result.auth;
    const [sessionsResult, reviewsResult] = await Promise.all([
      client
      .from("skillswap_sessions")
      .select("id,cycle_id,teacher_id,learner_id,skill,starts_at,duration_minutes,status,teacher_confirmed_at,learner_confirmed_at,created_at")
      .or(`teacher_id.eq.${userId},learner_id.eq.${userId}`)
      .order("starts_at", { ascending: false })
      .limit(100),
      client
        .from("skillswap_reviews")
        .select("session_id")
        .eq("reviewer_id", userId)
        .limit(100),
    ]);
    const error = sessionsResult.error ?? reviewsResult.error;
    if (error) return databaseErrorResponse(error, "Nu am putut încărca sesiunile.");

    const rows = (sessionsResult.data ?? []) as SessionRow[];
    const reviewedSessionIds = new Set((reviewsResult.data ?? []).map((review) => review.session_id));
    const userIds = [...new Set(rows.flatMap((session) => [
      session.teacher_id,
      session.learner_id,
    ]))];
    const { data: profiles, error: profileError } = userIds.length
      ? await client
          .from("skillswap_profiles")
          .select("user_id,display_name")
          .in("user_id", userIds)
      : { data: [], error: null };
    if (profileError) {
      return databaseErrorResponse(profileError, "Nu am putut încărca participanții sesiunilor.");
    }

    const names = new Map((profiles ?? []).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]));
    return Response.json({
      sessions: rows.map((session) => ({
        ...session,
        teacher_name: names.get(session.teacher_id) ?? "Membru SkillSwap",
        learner_name: names.get(session.learner_id) ?? "Membru SkillSwap",
        reviewed_by_me: reviewedSessionIds.has(session.id),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut încărca sesiunile.");
  }
}

export async function POST(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const body: unknown = await readJsonBody(request);
  if (!isRecord(body) || !isUuid(body.teacherId)) {
    return Response.json({ error: "Alege un partener valid." }, { status: 400 });
  }
  const skill = normalizeSkillKey(body.skill);
  const startsAt = parseSessionStart(body.startsAt);
  if (!skill || !startsAt) {
    return Response.json({ error: "Alege o abilitate și o oră validă." }, { status: 400 });
  }

  try {
    const { data: sessionId, error } = await result.auth.client.rpc(
      "skillswap_create_session",
      {
        p_teacher_id: body.teacherId,
        p_skill: skill,
        p_starts_at: startsAt,
      },
    );
    if (error) {
      const message = error.code === "P0001"
        ? sessionCreationErrors[error.message]
        : undefined;
      if (message) return Response.json({ error: message }, { status: 400 });
      return databaseErrorResponse(
        error,
        "Nu am putut trimite propunerea de schimb. Încearcă din nou mai târziu.",
      );
    }
    return Response.json({ sessionId }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error, "Nu am putut trimite propunerea de schimb.");
  }
}
