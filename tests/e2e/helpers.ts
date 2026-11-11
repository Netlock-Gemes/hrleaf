import { Page, expect } from "@playwright/test";

import { loadEnv } from "./safety";

loadEnv();
export const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

export async function signIn(page: Page, username: string, password: string, next = "") {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.waitForLoadState("networkidle");
  await page.fill("#username", username);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}

export const editor = (page: Page) => page.locator('[aria-label="Document text"]');

export async function type(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
  await page.waitForTimeout(400);
}

export async function save(page: Page) {
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();
}

export const notFound = (page: Page) => expect(page.getByText("There's nothing here")).toBeVisible();
