import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthClient,
  encryptGmailSession,
  GMAIL_SESSION_COOKIE,
  GMAIL_STATE_COOKIE,
  gmailCookieOptions,
  SESSION_MAX_AGE,
} from "@/lib/gmail-auth";

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

  if (!stateCookie || !state || !matchesState(stateCookie, state)) {
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

    const response = assistantRedirect(request, "connected");
    response.cookies.set(
      GMAIL_SESSION_COOKIE,
      encryptGmailSession({
        email: profile.emailAddress,
        refreshToken: tokens.refresh_token,
      }),
      { ...gmailCookieOptions(), maxAge: SESSION_MAX_AGE },
    );
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Gmail OAuth callback failed", error);
    const response = assistantRedirect(request, "connect-error");
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  }
}
