import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  readGmailOAuthState,
  createOAuthClient,
  encryptGmailSession,
  GMAIL_STATE_COOKIE,
} from "@/lib/gmail-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function matchesState(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function assistantRedirect(request: Request, status: string) {
  const url = new URL("/assistant", request.url);
  url.searchParams.set("gmail", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const stateCookie = request.cookies.get(GMAIL_STATE_COOKIE)?.value;
  const state = url.searchParams.get("state");

  if (url.searchParams.has("error")) {
    const response = assistantRedirect(request, "denied");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  }

  const oauthState = stateCookie ? readGmailOAuthState(stateCookie) : null;
  if (!oauthState || !state || !matchesState(oauthState.nonce, state)) {
    const response = assistantRedirect(request, "state-error");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    const response = assistantRedirect(request, "connect-error");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Google did not return the required offline access token.");
    }

    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!profileResponse.ok) {
      throw new Error(`Gmail profile lookup failed (${profileResponse.status}).`);
    }
    const profile: unknown = await profileResponse.json();
    if (
      typeof profile !== "object" ||
      profile === null ||
      !("emailAddress" in profile) ||
      typeof profile.emailAddress !== "string"
    ) {
      throw new Error("Gmail did not return an email address.");
    }

    const gmailSession = {
      email: profile.emailAddress,
      refreshToken: tokens.refresh_token,
    };
    const admin = createSupabaseAdminClient();
    const { error: saveError } = await admin.from("gmail_connections").upsert(
      {
        user_id: oauthState.userId,
        encrypted_refresh_token: encryptGmailSession(gmailSession),
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (saveError) throw saveError;

    const response = assistantRedirect(request, "connected");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Gmail OAuth callback failed", error);
    const response = assistantRedirect(request, "connect-error");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  }
}
