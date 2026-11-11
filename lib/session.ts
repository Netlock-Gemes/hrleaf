/**
 * Signed-cookie sessions for the admin and members.
 * Uses Web Crypto only, so it runs anywhere (Node or Edge).
 *
 * Token format: base64url(payloadJson).base64url(hmacSha256(payload))
 *
 * The signature proves the cookie came from us. Members are also checked against
 * the database on every request (see server/auth.ts), so disabling a member or
 * resetting their password signs them out immediately.
 */

export const SESSION_COOKIE = "hrleaf_session";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const MEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  /** "admin:<ADMIN_USERNAME>" for the admin, the user id for members. */
  sub: string;
  role: "admin" | "member";
  /** Members: must match users.session_version. */
  ver: number;
  exp: number;
};

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "===".slice((base64.length + 3) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

export const adminSubject = () => `admin:${process.env.ADMIN_USERNAME ?? ""}`;

export async function createSessionToken(
  data: Omit<SessionPayload, "exp">,
  maxAge: number,
): Promise<string> {
  const payload: SessionPayload = { ...data, exp: Math.floor(Date.now() / 1000) + maxAge };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

/** Checks signature and expiry only. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const valid = await crypto.subtle.verify("HMAC", await getKey(), fromBase64Url(sig), encoder.encode(body));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (payload.role === "admin") {
      // An admin session only counts for the admin currently configured in .env.
      return payload.sub === adminSubject() ? payload : null;
    }
    if (payload.role === "member" && typeof payload.sub === "string" && typeof payload.ver === "number") {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (via HMAC digests, so lengths don't leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const key = await getKey();
  const [da, db] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
