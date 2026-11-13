import { createHmac } from "node:crypto";
import { authenticateSkillSwapRequest } from "@/lib/skillswap/server";

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export async function GET(request: Request) {
  const result = await authenticateSkillSwapRequest(request);
  if (!result.auth) return result.response;

  const turnUrls = (process.env.SKILLSWAP_TURN_URL ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const sharedSecret = process.env.SKILLSWAP_TURN_SECRET;
  if (turnUrls.length === 0 && !sharedSecret) {
    return Response.json({
      iceServers: STUN_SERVERS,
      turnConfigured: false,
    }, { headers: { "Cache-Control": "no-store" } });
  }
  if (
    turnUrls.length === 0 ||
    !sharedSecret ||
    turnUrls.some((url) => !/^turns?:/i.test(url))
  ) {
    return Response.json(
      { error: "Configurația TURN SkillSwap este incompletă." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const configuredTtl = Number.parseInt(process.env.SKILLSWAP_TURN_TTL_SECONDS ?? "", 10);
  const ttlSeconds = Number.isFinite(configuredTtl)
    ? Math.min(7200, Math.max(300, configuredTtl))
    : 900;
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${result.auth.userId}`;
  const credential = createHmac("sha1", sharedSecret)
    .update(username)
    .digest("base64");

  return Response.json({
    iceServers: [
      ...STUN_SERVERS,
      { urls: turnUrls, username, credential },
    ],
    turnConfigured: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
