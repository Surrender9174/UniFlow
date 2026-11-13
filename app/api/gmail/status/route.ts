import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  decryptGmailSession,
  GMAIL_SESSION_COOKIE,
  InvalidGmailSessionError,
} from "@/lib/gmail-auth";
import {
  createSupabaseAdminClient,
  getRequestUser,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Autentifică-te din nou pentru a verifica Gmail." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: connection, error } = await admin
      .from("gmail_connections")
      .select("encrypted_refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    let email: string | null = null;
    if (connection?.encrypted_refresh_token) {
      email = decryptGmailSession(connection.encrypted_refresh_token).email;
    }
    const response = NextResponse.json(
      { connected: Boolean(email), email },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.delete(GMAIL_SESSION_COOKIE);
    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Gmail status check failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof SupabaseServerConfigurationError
            ? error.message
            : error instanceof InvalidGmailSessionError
              ? "Sesiunea Gmail salvată este invalidă. Reconectează Gmail."
              : "Nu am putut verifica starea conexiunii Gmail.",
      },
      {
        status: error instanceof SupabaseServerConfigurationError ? 503 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
