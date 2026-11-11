import "server-only";

import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, no extra dependency).
 * Stored as: scrypt$N$r$p$saltB64$hashB64
 */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Used when the username doesn't exist, so a wrong username takes as long as a wrong password.
const DUMMY = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = (stored ?? DUMMY).split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const key = await derive(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return stored != null && key.length === expected.length && timingSafeEqual(key, expected);
}

// No look-alike characters (0/O, 1/l/I), so passwords can be read out or typed from a phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A readable random password like "kf7Q-m3Rx-9tPw". About 71 bits. */
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export const MIN_PASSWORD_LENGTH = 10;
