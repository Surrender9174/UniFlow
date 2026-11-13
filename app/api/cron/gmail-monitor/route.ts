import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { decryptGmailSession, getGmailAccessToken } from "@/lib/gmail-auth";
import { classifySchoolEmail, ProviderRequestError } from "@/lib/email-analysis";
import { sendWebPush } from "@/lib/web-push";
import {
  createSupabaseAdminClient,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";

type GmailConnection = {
  user_id: string;
  encrypted_refresh_token: string;
  last_checked_at: string;
};

type GmailEmail = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  body: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.MONITOR_CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expectedSecret || expectedSecret.length < 32 || !providedSecret) return false;
  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderRequestError(
      `Gmail monitoring request failed (HTTP ${response.status}).`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

function getHeader(message: Record<string, unknown>, headerName: string) {
  if (!isRecord(message.payload) || !Array.isArray(message.payload.headers)) return "";
  const header = message.payload.headers.find(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      item.name.toLowerCase() === headerName.toLowerCase() &&
      typeof item.value === "string",
  );
  return isRecord(header) && typeof header.value === "string" ? header.value : "";
}

function getMessageBody(message: Record<string, unknown>) {
  const plain: string[] = [];
  const html: string[] = [];
  const visit = (part: unknown) => {
    if (!isRecord(part)) return;
    if (isRecord(part.body) && typeof part.body.data === "string") {
      const text = Buffer.from(part.body.data, "base64url").toString("utf8");
      if (part.mimeType === "text/plain") plain.push(text);
      if (part.mimeType === "text/html") html.push(text);
    }
    if (Array.isArray(part.parts)) part.parts.forEach(visit);
  };
  if (isRecord(message.payload)) visit(message.payload);
  const htmlText = html
    .join("\n")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  const snippet = typeof message.snippet === "string" ? message.snippet : "";
  return (plain.join("\n").trim() || htmlText || snippet).slice(0, 3_000);
}

function getEmail(message: unknown, expectedId: string): GmailEmail {
  if (!isRecord(message)) {
    throw new ProviderRequestError("Gmail returned an invalid message.", 502);
  }
  const timestamp = Number(message.internalDate);
  return {
    id: expectedId,
    subject: getHeader(message, "subject") || "(Fără subiect)",
    from: getHeader(message, "from"),
    receivedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "",
    body: getMessageBody(message),
  };
}

async function getNewMessageIds(accessToken: string, lastCheckedAt: string) {
  const lastCheckedTimestamp = Date.parse(lastCheckedAt);
  if (!Number.isFinite(lastCheckedTimestamp)) {
    throw new Error("Gmail connection checkpoint is invalid.");
  }
  const queryTimestamp = Math.max(0, Math.floor((lastCheckedTimestamp - 60_000) / 1_000));
  const ids = new Set<string>();
  let pageToken: string | null = null;
  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", `in:inbox after:${queryTimestamp}`);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const result: unknown = await gmailFetch(url.toString(), accessToken);
    if (!isRecord(result)) {
      throw new ProviderRequestError("Gmail returned an invalid message list.", 502);
    }
    if (Array.isArray(result.messages)) {
      for (const item of result.messages) {
        if (isRecord(item) && typeof item.id === "string") ids.add(item.id);
      }
    }
    pageToken = typeof result.nextPageToken === "string" ? result.nextPageToken : null;
  } while (pageToken);
  return [...ids];
}

async function notifyPendingEmails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data: pending, error: pendingError } = await admin
    .from("app_notifications")
    .select("id, title, body, href")
    .eq("user_id", userId)
    .is("push_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (pendingError) throw pendingError;
  if (!pending?.length) return;

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (subscriptionError) throw subscriptionError;

  for (const notification of pending) {
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await sendWebPush(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            href: notification.href,
          }),
        );
      } catch (error) {
        const statusCode =
          isRecord(error) && typeof error.statusCode === "number" ? error.statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
          if (deleteError) throw deleteError;
          continue;
        }
        throw error;
      }
    }
    const { error: updateError } = await admin
      .from("app_notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", notification.id);
    if (updateError) throw updateError;
  }
}

async function processConnection(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  connection: GmailConnection,
) {
  const session = decryptGmailSession(connection.encrypted_refresh_token);
  const accessToken = await getGmailAccessToken(session);
  const ids = await getNewMessageIds(accessToken, connection.last_checked_at);
  let createdNotifications = 0;

  if (ids.length > 0) {
    const sourceKeys = ids.map((id) => `gmail:${id}`);
    const { data: existing, error: existingError } = await admin
      .from("app_notifications")
      .select("source_key")
      .eq("user_id", connection.user_id)
      .in("source_key", sourceKeys);
    if (existingError) throw existingError;
    const knownKeys = new Set((existing ?? []).map((item) => item.source_key));

    for (const id of ids) {
      if (knownKeys.has(`gmail:${id}`)) continue;
      const message = await gmailFetch<unknown>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        accessToken,
      );
      const email = getEmail(message, id);
      const classification = await classifySchoolEmail(email);
      if (!classification.relevant) continue;

      const { data: inserted, error: insertError } = await admin
        .from("app_notifications")
        .upsert(
          {
            user_id: connection.user_id,
            source_key: `gmail:${id}`,
            title: classification.title,
            body: classification.body,
            href: "/assistant",
          },
          { onConflict: "user_id,source_key", ignoreDuplicates: true },
        )
        .select("id");
      if (insertError) throw insertError;
      createdNotifications += inserted?.length ?? 0;
    }
  }

  await notifyPendingEmails(admin, connection.user_id);
  const { error: checkpointError } = await admin
    .from("gmail_connections")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("user_id", connection.user_id);
  if (checkpointError) throw checkpointError;
  return createdNotifications;
}

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.MONITOR_CRON_SECRET;
  if (!configuredSecret || configuredSecret.length < 32) {
    return NextResponse.json(
      { error: "Set MONITOR_CRON_SECRET to a random secret of at least 32 characters." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: connections, error } = await admin
      .from("gmail_connections")
      .select("user_id, encrypted_refresh_token, last_checked_at");
    if (error) throw error;

    let createdNotifications = 0;
    let failedAccounts = 0;
    for (const connection of (connections ?? []) as GmailConnection[]) {
      try {
        createdNotifications += await processConnection(admin, connection);
      } catch (error) {
        failedAccounts += 1;
        console.error("Gmail background monitoring failed for one account", error);
      }
    }

    const response = NextResponse.json(
      { processedAccounts: (connections ?? []).length, failedAccounts, createdNotifications },
      { status: failedAccounts ? 500 : 200 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Gmail monitoring endpoint failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof SupabaseServerConfigurationError
            ? error.message
            : "Gmail monitoring could not complete.",
      },
      {
        status: error instanceof SupabaseServerConfigurationError ? 503 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
