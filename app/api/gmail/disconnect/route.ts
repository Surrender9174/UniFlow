import { NextRequest, NextResponse } from "next/server";
import { GMAIL_SESSION_COOKIE } from "@/lib/gmail-auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  const response = NextResponse.json({ disconnected: true });
  response.cookies.delete(GMAIL_SESSION_COOKIE);
  return response;
}
