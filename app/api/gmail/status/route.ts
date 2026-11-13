import { NextRequest, NextResponse } from "next/server";
import {
  ConfigurationError,
  GMAIL_SESSION_COOKIE,
  InvalidGmailSessionError,
  readGmailSession,
} from "@/lib/gmail-auth";

export async function GET(request: NextRequest) {
  try {
    const session = readGmailSession(request.cookies.get(GMAIL_SESSION_COOKIE)?.value);
    return NextResponse.json(
      { connected: Boolean(session), email: session?.email ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InvalidGmailSessionError) {
      const response = NextResponse.json(
        { connected: false, email: null },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.delete(GMAIL_SESSION_COOKIE);
      return response;
    }
    if (!(error instanceof ConfigurationError)) throw error;
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
