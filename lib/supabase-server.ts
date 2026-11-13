import { createClient, type User } from "@supabase/supabase-js";

export class SupabaseServerConfigurationError extends Error {}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new SupabaseServerConfigurationError("Set NEXT_PUBLIC_SUPABASE_URL.");
  return url;
}

export async function getRequestUser(request: Request): Promise<User | null> {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return null;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new SupabaseServerConfigurationError(
      "Set NEXT_PUBLIC_SUPABASE_ANON_KEY to verify authenticated requests.",
    );
  }

  const client = createClient(getSupabaseUrl(), anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user;
}

export function createSupabaseAdminClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new SupabaseServerConfigurationError(
      "Set SUPABASE_SECRET_KEY for server-side Gmail monitoring.",
    );
  }
  return createClient(getSupabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
