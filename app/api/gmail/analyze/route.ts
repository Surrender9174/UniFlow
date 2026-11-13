import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  ConfigurationError,
  decryptGmailSession,
  InvalidGmailSessionError,
} from "@/lib/gmail-auth";
import {
  createSupabaseAdminClient,
  getRequestUser,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";
import {
  analyzeInbox,
  type AssistantScheduleContext,
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

function isClockTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours < 24 && minutes < 60;
}

function isScheduleContext(value: unknown): value is AssistantScheduleContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "events" in value &&
    Array.isArray(value.events) &&
    value.events.length <= 200 &&
    value.events.every(
      (event) =>
        typeof event === "object" &&
        event !== null &&
        "weekday" in event &&
        typeof event.weekday === "number" &&
        Number.isInteger(event.weekday) &&
        event.weekday >= 0 &&
        event.weekday <= 6 &&
        "start" in event &&
        isClockTime(event.start) &&
        "end" in event &&
        isClockTime(event.end) &&
        "title" in event &&
        typeof event.title === "string" &&
        event.title.length > 0 &&
        event.title.length <= 200 &&
        "type" in event &&
        typeof event.type === "string" &&
        event.type.length <= 60 &&
        "room" in event &&
        typeof event.room === "string" &&
        event.room.length <= 100,
    ) &&
    "tasks" in value &&
    Array.isArray(value.tasks) &&
    value.tasks.length <= 100 &&
    value.tasks.every(
      (task) =>
        typeof task === "object" &&
        task !== null &&
        "id" in task &&
        typeof task.id === "string" &&
        task.id.length > 0 &&
        task.id.length <= 100 &&
        "title" in task &&
        typeof task.title === "string" &&
        task.title.length > 0 &&
        task.title.length <= 200 &&
        "subject" in task &&
        typeof task.subject === "string" &&
        task.subject.length <= 200 &&
        "dueAt" in task &&
        typeof task.dueAt === "string" &&
        Number.isFinite(Date.parse(task.dueAt)) &&
        "category" in task &&
        (task.category === "Studiu" ||
          task.category === "Practică" ||
          task.category === "Test"),
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

function isTaskRescheduleRequest(question: string, history: ChatTurn[]) {
  const normalized = question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const asksToMove =
    /\b(mut\w*|aman\w*|reprogram\w*|decal\w*|schimb\w*|move\w*|postpon\w*|reschedul\w*)\b/.test(
      normalized,
    );
  const mentionsTask =
    /\b(task\w*|sarcin\w*|tem\w*|lucrare\w*|deadline\w*|termen\w*)\b/.test(
      normalized,
    );
  const previousTaskContext = history.some((turn) =>
    /\b(task\w*|sarcin\w*|tem\w*|lucrare\w*|deadline\w*|termen\w*)\b/.test(
      turn.content
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase(),
    ),
  );
  return asksToMove && (mentionsTask || previousTaskContext);
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

  const scheduleValue =
    typeof body === "object" && body !== null && "schedule" in body
      ? body.schedule
      : { events: [], tasks: [] };
  if (!isScheduleContext(scheduleValue)) {
    return NextResponse.json(
      { error: "The saved schedule information is invalid." },
      { status: 400 },
    );
  }

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Autentifică-te din nou pentru a folosi asistentul." },
        { status: 401 },
      );
    }
    const searchInbox = isEmailRelatedQuestion(body.question);
    let session = null;
    if (searchInbox) {
      const admin = createSupabaseAdminClient();
      const { data: connection, error } = await admin
        .from("gmail_connections")
        .select("encrypted_refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      session = connection?.encrypted_refresh_token
        ? decryptGmailSession(connection.encrypted_refresh_token)
        : null;
    }
    const result = await analyzeInbox(
      session,
      body.question.trim(),
      historyValue,
      timeContextValue,
      scheduleValue,
      isTaskRescheduleRequest(body.question, historyValue),
      isTaskCreationRequest(body.question, historyValue),
      searchInbox,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Inbox analysis failed", error);
    const message =
      error instanceof ConfigurationError ||
      error instanceof SupabaseServerConfigurationError ||
      error instanceof ProviderRequestError
        ? error.message
        : error instanceof InvalidGmailSessionError
          ? "Your Gmail session is invalid. Disconnect and reconnect your account."
        : "Inbox analysis failed. Check your Gmail and Gemini configuration, then try again.";
    const status =
      error instanceof ProviderRequestError
        ? error.status
        : error instanceof SupabaseServerConfigurationError
          ? 503
          : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
