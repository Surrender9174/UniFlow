import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  createGmailOAuthState,
  createOAuthClient,
  ConfigurationError,
  GMAIL_READONLY_SCOPE,
  GMAIL_STATE_COOKIE,
} from "@/lib/gmail-auth";
import {
  getRequestUser,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Autentifică-te din nou pentru a conecta Gmail." },
        { status: 401 },
      );
    }

    const client = createOAuthClient();
    const nonce = randomBytes(32).toString("base64url");
    const state = createGmailOAuthState({ nonce, userId: user.id });
    const authorizationUrl = client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: [GMAIL_READONLY_SCOPE],
      state: nonce,
    });
    const response = NextResponse.json({ authorizationUrl });
    response.cookies.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Gmail OAuth setup failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof SupabaseServerConfigurationError
            ? error.message
            : error instanceof ConfigurationError
              ? error.message
            : "Nu am putut porni conectarea Gmail. Verifică setările Google OAuth.",
      },
      {
        status:
          error instanceof SupabaseServerConfigurationError ||
          error instanceof ConfigurationError
            ? 503
            : 500,
      },
    );
  }
}
