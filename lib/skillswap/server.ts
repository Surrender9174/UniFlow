import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SkillSwapAuth = {
  client: SupabaseClient;
  userId: string;
};

export type SkillSwapAuthResult =
  | { auth: SkillSwapAuth; response?: never }
  | { auth?: never; response: Response };

export async function authenticateSkillSwapRequest(
  request: Request,
): Promise<SkillSwapAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: Response.json(
        { error: "SkillSwap nu este configurat pe server." },
        { status: 503 },
      ),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
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

export function databaseErrorResponse(error: unknown, fallback: string) {
  console.error("SkillSwap database request failed:", error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
