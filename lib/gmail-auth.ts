import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { OAuth2Client } from "google-auth-library";

export const GMAIL_SESSION_COOKIE = "uniflow_gmail_session";
export const GMAIL_STATE_COOKIE = "uniflow_gmail_state";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type GmailSession = {
  email: string;
  refreshToken: string;
};

export type GmailOAuthState = {
  nonce: string;
  userId: string;
};

export class ConfigurationError extends Error {}
export class InvalidGmailSessionError extends Error {}

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new ConfigurationError(
      "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env.local.",
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function getEncryptionKey() {
  const secret = process.env.GMAIL_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigurationError(
      "Set GMAIL_SESSION_SECRET to a random secret with at least 32 characters.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function createGmailOAuthState(state: GmailOAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", getEncryptionKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readGmailOAuthState(value: string): GmailOAuthState | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;

  const expected = createHmac("sha256", getEncryptionKey()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("nonce" in parsed) ||
      typeof parsed.nonce !== "string" ||
      !("userId" in parsed) ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return { nonce: parsed.nonce, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function encryptGmailSession(session: GmailSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptGmailSession(value: string): GmailSession {
  const key = getEncryptionKey();

  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) throw new Error("Invalid session length.");

    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const decrypted = Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(decrypted);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("email" in parsed) ||
      !("refreshToken" in parsed) ||
      typeof parsed.email !== "string" ||
      typeof parsed.refreshToken !== "string"
    ) {
      throw new Error("Invalid session payload.");
    }

    return { email: parsed.email, refreshToken: parsed.refreshToken };
  } catch {
    throw new InvalidGmailSessionError("The Gmail session cookie is invalid.");
  }
}

export function readGmailSession(value: string | undefined) {
  return value ? decryptGmailSession(value) : null;
}

export function gmailCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function getGmailAccessToken(session: GmailSession) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: session.refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google did not return an access token.");
  return token;
}
