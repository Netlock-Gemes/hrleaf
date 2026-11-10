/**
 * Minimal signed-cookie session for the single admin account.
 * Uses Web Crypto only, so it runs in both the Edge middleware and Node server code.
 *
 * Token format: base64url(payloadJson).base64url(hmacSha256(payload))
 */

export const SESSION_COOKIE = "hrleaf_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

type SessionPayload = { sub: string; exp: number };

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

export async function createSessionToken(username: string): Promise<string> {
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(body)),
  );
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      fromBase64Url(sig),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
      return null;
    }
    // A session only counts for the admin currently configured in .env.
    if (payload.sub !== process.env.ADMIN_USERNAME) return null;
    return payload;
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
