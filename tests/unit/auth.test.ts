import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/safe-next";
import { adminSubject, createSessionToken, safeEqual, verifySessionToken } from "@/lib/session";
import { generatePassword, hashPassword, verifyPassword } from "@/server/passwords";

describe("sessions", () => {
  it("round-trips a member session", async () => {
    const token = await createSessionToken({ sub: "abc", role: "member", ver: 3 }, 60);
    expect(await verifySessionToken(token)).toMatchObject({ sub: "abc", role: "member", ver: 3 });
  });
  it("rejects tampered, expired and foreign-admin tokens", async () => {
    const token = await createSessionToken({ sub: "abc", role: "member", ver: 1 }, 60);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: adminSubject(), role: "admin", ver: 0, exp: 9e9 })).toString("base64url");
    expect(await verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(await verifySessionToken(await createSessionToken({ sub: "abc", role: "member", ver: 1 }, -10))).toBeNull();
    expect(await verifySessionToken(await createSessionToken({ sub: "admin:someone-else", role: "admin", ver: 0 }, 60))).toBeNull();
    expect(await verifySessionToken(await createSessionToken({ sub: adminSubject(), role: "admin", ver: 0 }, 60))).not.toBeNull();
  });
  it("compares strings safely", async () => {
    expect(await safeEqual("a", "a")).toBe(true);
    expect(await safeEqual("a", "ab")).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
  it("generates readable passwords", () => {
    const pw = generatePassword();
    expect(pw).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
    expect(pw).not.toMatch(/[01oOlI]/);
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/gaurav")).toBe("/gaurav");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
