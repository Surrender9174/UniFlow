import { NextRequest, NextResponse } from "next/server";
import { ConfigurationError } from "@/lib/gmail-auth";
import {
  analyzeWhatsAppExport,
  ProviderRequestError,
  type TimeContext,
} from "@/lib/email-analysis";

const MAX_EXPORT_BYTES = 200 * 1024;

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

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Send a valid WhatsApp .txt export." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".txt")) {
    return NextResponse.json(
      { error: "Choose a WhatsApp exported .txt file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_EXPORT_BYTES) {
    return NextResponse.json(
      { error: "The export is over 200 KB. Export a shorter date range and try again." },
      { status: 413 },
    );
  }

  const exportedChat = await file.text();
  if (!exportedChat.trim()) {
    return NextResponse.json({ error: "The WhatsApp export is empty." }, { status: 400 });
  }

  const timeContextValue = {
    currentTime: formData.get("currentTime"),
    timeZone: formData.get("timeZone"),
  };
  if (!isTimeContext(timeContextValue)) {
    return NextResponse.json(
      { error: "The local date and time information is invalid." },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeWhatsAppExport(exportedChat, timeContextValue);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("WhatsApp export analysis failed", error);
    const unexpectedDetail =
      error instanceof Error
        ? `${error.name}: ${error.message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted key]").slice(0, 240)}`
        : "non-Error exception";
    const message =
      error instanceof ConfigurationError || error instanceof ProviderRequestError
        ? error.message
        : `Unexpected ${unexpectedDetail} during WhatsApp analysis.`;
    const status = error instanceof ProviderRequestError ? error.status : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
