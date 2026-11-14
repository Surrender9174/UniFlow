import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type QueueLessAuth = {
  client: SupabaseClient;
  userId: string;
};

export type QueueLessAuthResult =
  | { auth: QueueLessAuth; response?: never }
  | { auth?: never; response: Response };

export async function authenticateQueueLessRequest(
  request: Request,
): Promise<QueueLessAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: Response.json(
        { error: "QueueLess nu este configurat pe server." },
        { status: 503 },
      ),
    };
  }

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return {
      response: Response.json({ error: "Autentificarea este necesară." }, { status: 401 }),
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return {
      response: Response.json({ error: "Sesiunea nu este validă." }, { status: 401 }),
    };
  }

  return { auth: { client, userId: data.user.id } };
}

export function isQueueLessRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isQueueLessUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function readQueueLessJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

export function queueLessDatabaseError(error: unknown, fallback: string) {
  console.error("QueueLess database request failed:", error);
  return Response.json({ error: fallback }, { status: 500 });
}

export function queueLessActionError(error: unknown, fallback: string) {
  const databaseError = isQueueLessRecord(error) ? error : null;
  const message = typeof databaseError?.message === "string" ? databaseError.message : "";
  const code = typeof databaseError?.code === "string" ? databaseError.code : "";
  if (code === "23505") {
    return Response.json({ error: "Ai deja un bon activ într-o altă locație." }, {
      status: 409,
    });
  }
  if (code === "42501") {
    return Response.json({ error: "Nu ai permisiunea pentru această acțiune." }, {
      status: 403,
    });
  }
  if (code === "P0001") {
    if (message.includes("Required documents are not confirmed")) {
      return Response.json(
        { error: "Confirmă toate documentele necesare înainte să iei un bon." },
        { status: 400 },
      );
    }
    if (message.includes("There is no following ticket")) {
      return Response.json(
        { error: "Nu există un bon după tine pe care să îl poți lăsa să treacă." },
        { status: 409 },
      );
    }
    if (message.includes("Staff access required")) {
      return Response.json({ error: "Nu ai acces de personal la această locație." }, {
        status: 403,
      });
    }
    if (message.includes("Ticket can no longer be delayed")) {
      return Response.json({ error: "Acest bon nu mai poate fi amânat." }, { status: 409 });
    }
    if (message.includes("Ticket not found")) {
      return Response.json({ error: "Bonul nu a fost găsit." }, { status: 404 });
    }
    if (message.includes("Location is not available")) {
      return Response.json({ error: "Locația nu este disponibilă momentan." }, { status: 404 });
    }
    console.error("QueueLess business rule failed:", error);
    return Response.json({ error: fallback }, { status: 409 });
  }
  return queueLessDatabaseError(error, fallback);
}
