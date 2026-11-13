import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthClient,
  GMAIL_READONLY_SCOPE,
  GMAIL_STATE_COOKIE,
} from "@/lib/gmail-auth";

export async function GET(request: NextRequest) {
  const requestUrl = request.url;
  try {
    const client = createOAuthClient();
    const state = randomBytes(32).toString("base64url");
    const authorizationUrl = client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: [GMAIL_READONLY_SCOPE],
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("Gmail OAuth setup failed", error);
    return NextResponse.redirect(new URL("/assistant?gmail=setup-error", requestUrl));
  }
}
