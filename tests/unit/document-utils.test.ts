import { describe, expect, it } from "vitest";

import { isDocumentContentEmpty } from "@/lib/content";
import { RESERVED_SLUGS, SHARE_TOKEN_PATTERN, countWords, derivedFields, extractPreview, normaliseSlug } from "@/server/document-utils";

const doc = (...paragraphs: string[]) => ({
  root: {
    type: "root",
    children: paragraphs.map((text) => ({ type: "paragraph", children: text ? [{ type: "text", text }] : [] })),
  },
});

describe("normaliseSlug", () => {
  it("lowercases and accepts valid names", () => {
    expect(normaliseSlug("My-Note-2")).toBe("my-note-2");
    expect(normaliseSlug("%20tex%20")).toBe("tex");
  });
  it("rejects invalid names", () => {
    for (const bad of ["", "-start", "has space", "a/b", "x".repeat(65), "%E0%A4%A", "émoji"]) {
      expect(normaliseSlug(bad)).toBeNull();
    }
  });
  it("reserves real routes", () => {
    for (const r of ["login", "s", "ainzooalgown", "privacy"]) expect(RESERVED_SLUGS.has(r)).toBe(true);
  });
});

describe("content helpers", () => {
  it("treats blank documents as empty", () => {
    expect(isDocumentContentEmpty(null)).toBe(true);
    expect(isDocumentContentEmpty(doc("", "   "))).toBe(true);
    expect(isDocumentContentEmpty(doc("", "hello"))).toBe(false);
    expect(isDocumentContentEmpty({ root: { children: [{ type: "horizontalrule" }] } })).toBe(false);
  });
  it("builds previews, sizes and word counts", () => {
    const d = doc("Hello world", "Second line");
    expect(extractPreview(d)).toBe("Hello world · Second line");
    expect(countWords(d)).toBe(4);
    const f = derivedFields(d);
    expect(f.is_empty).toBe(false);
    expect(f.size).toBe(JSON.stringify(d).length);
  });
});

describe("share tokens", () => {
  it("match exactly 12 url-safe characters", () => {
    expect(SHARE_TOKEN_PATTERN.test("abcDEF123_-x")).toBe(true);
    expect(SHARE_TOKEN_PATTERN.test("short")).toBe(false);
    expect(SHARE_TOKEN_PATTERN.test("abcDEF123_-x/")).toBe(false);
  });
});
