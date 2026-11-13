import { NextRequest, NextResponse } from "next/server";
import {
  ConfigurationError,
  GMAIL_SESSION_COOKIE,
  InvalidGmailSessionError,
  readGmailSession,
} from "@/lib/gmail-auth";
import {
  analyzeInbox,
  ProviderRequestError,
  type ChatTurn,
} from "@/lib/email-analysis";

function isChatHistory(value: unknown): value is ChatTurn[] {
  return (
    Array.isArray(value) &&
    value.length <= 8 &&
    value.every(
      (turn) =>
        typeof turn === "object" &&
        turn !== null &&
        "role" in turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        "content" in turn &&
        typeof turn.content === "string" &&
        turn.content.length <= 1_200,
    )
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("question" in body) ||
    typeof body.question !== "string" ||
    body.question.trim().length === 0 ||
    body.question.length > 600
  ) {
    return NextResponse.json(
      { error: "Write a question of 1 to 600 characters." },
      { status: 400 },
    );
  }

  const historyValue =
    typeof body === "object" && body !== null && "history" in body
      ? body.history
      : [];
  if (!isChatHistory(historyValue)) {
    return NextResponse.json({ error: "Chat history is invalid." }, { status: 400 });
  }

  try {
    const session = readGmailSession(
      request.cookies.get(GMAIL_SESSION_COOKIE)?.value,
    );
    if (!session) {
      return NextResponse.json(
        { error: "Connect your Gmail account before asking about your email." },
        { status: 401 },
      );
    }
    const result = await analyzeInbox(
      session,
      body.question.trim(),
      historyValue,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Inbox analysis failed", error);
    const message =
      error instanceof ConfigurationError || error instanceof ProviderRequestError
        ? error.message
        : error instanceof InvalidGmailSessionError
          ? "Your Gmail session is invalid. Disconnect and reconnect your account."
          : "Inbox analysis failed. Check your Gmail and OpenAI configuration, then try again.";
    const status = error instanceof ProviderRequestError ? 502 : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
