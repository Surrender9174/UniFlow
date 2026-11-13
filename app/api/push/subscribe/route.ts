import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  createSupabaseAdminClient,
  getRequestUser,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";

function isPushSubscription(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (typeof value !== "object" || value === null || !("endpoint" in value) || typeof value.endpoint !== "string") {
    return false;
  }
  let endpoint: URL;
  try {
    endpoint = new URL(value.endpoint);
  } catch {
    return false;
  }
  const hostname = endpoint.hostname.toLowerCase();
  const allowedPushService =
    hostname === "fcm.googleapis.com" ||
    hostname === "web.push.apple.com" ||
    hostname === "push.services.mozilla.com" ||
    hostname.endsWith(".push.services.mozilla.com") ||
    hostname.endsWith(".notify.windows.com");
  return (
    endpoint.protocol === "https:" &&
    !endpoint.username &&
    !endpoint.password &&
    !endpoint.port &&
    allowedPushService &&
    value.endpoint.length <= 2_048 &&
    "keys" in value &&
    typeof value.keys === "object" &&
    value.keys !== null &&
    "p256dh" in value.keys &&
    typeof value.keys.p256dh === "string" &&
    value.keys.p256dh.length <= 512 &&
    "auth" in value.keys &&
    typeof value.keys.auth === "string" &&
    value.keys.auth.length <= 512
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  let subscription: unknown;
  try {
    subscription = await request.json();
  } catch {
    return NextResponse.json({ error: "Trimite o subscripție Web Push validă." }, { status: 400 });
  }
  if (!isPushSubscription(subscription)) {
    return NextResponse.json({ error: "Subscripția Web Push este invalidă." }, { status: 400 });
  }

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Autentifică-te din nou pentru notificări." }, { status: 401 });
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return NextResponse.json({ subscribed: true });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Web Push subscription failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof SupabaseServerConfigurationError
            ? error.message
            : "Nu am putut salva subscripția Web Push.",
      },
      { status: error instanceof SupabaseServerConfigurationError ? 503 : 500 },
    );
  }
}
