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
  type TimeContext,
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

function isTimeContext(value: unknown): value is TimeContext {
  if (
    typeof value !== "object" ||
    value === null ||
    !("currentTime" in value) ||
    typeof value.currentTime !== "string" ||
    !value.currentTime.endsWith("Z") ||
    !Number.isFinite(Date.parse(value.currentTime)) ||
    !("timeZone" in value) ||
    typeof value.timeZone !== "string" ||
    value.timeZone.length > 100
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.timeZone }).format(
      new Date(value.currentTime),
    );
    return true;
  } catch {
    return false;
  }
}

function isTaskCreationRequest(question: string, history: ChatTurn[]) {
  const normalized = question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const asksToAdd =
    /\b(adaug\w*|pun\w*|trec\w*|salv\w*|not\w*|cree\w*|planific\w*|program\w*|includ\w*|bag\w*|add\w*|save\w*|put\w*|schedule\w*|create\w*)\b/.test(
      normalized,
    );
  const mentionsTasks =
    /\b(task\w*|sarcin\w*|lista\w*|de facut|ce trebuie sa fac|ce am de facut|to-do|todo)\b/.test(
      normalized,
    );
  const refersToPreviousTasks =
    /\b(adaug\w*|pun\w*|salv\w*|trec\w*|add\w*|put\w*)(?:-le| le|-o| o|-l| l| them| this)\b/.test(
      normalized,
    ) &&
    history.some((turn) => turn.role === "assistant");
  return asksToAdd && (mentionsTasks || refersToPreviousTasks);
}

function isEmailRelatedQuestion(question: string) {
  const normalized = question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return /\b(e-?mail\w*|gmail|inbox|mail\w*|mesaj\w*|message\w*|posta electronica)\b/.test(
    normalized,
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

  const timeContextValue =
    typeof body === "object" && body !== null && "timeContext" in body
      ? body.timeContext
      : null;
  if (!isTimeContext(timeContextValue)) {
    return NextResponse.json(
      { error: "The local date and time information is invalid." },
      { status: 400 },
    );
  }

  try {
    const session = readGmailSession(
      request.cookies.get(GMAIL_SESSION_COOKIE)?.value,
    );
    const result = await analyzeInbox(
      session,
      body.question.trim(),
      historyValue,
      timeContextValue,
      isTaskCreationRequest(body.question, historyValue),
      isEmailRelatedQuestion(body.question),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Inbox analysis failed", error);
    const message =
      error instanceof ConfigurationError || error instanceof ProviderRequestError
        ? error.message
        : error instanceof InvalidGmailSessionError
          ? "Your Gmail session is invalid. Disconnect and reconnect your account."
        : "Inbox analysis failed. Check your Gmail and Gemini configuration, then try again.";
    const status = error instanceof ProviderRequestError ? error.status : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
