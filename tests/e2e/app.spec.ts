import { Browser, Page, expect, test } from "@playwright/test";

import { ADMIN, editor, notFound, save, signIn, type } from "./helpers";
import { PREFIX } from "./safety";

const TEAM = `${PREFIX}team`;
const SECRET = `${PREFIX}secret`;
const PUBLIC = `${PREFIX}public`;
const MEMBER = `${PREFIX}friend`;

test.describe.configure({ mode: "serial" });

let admin: Page;
let member: Page;
let memberPassword = "";
let shareLink = "";

async function newPage(browser: Browser, mobile = false) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 900 } },
  );
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  return ctx.newPage();
}

test.beforeAll(async ({ browser }) => {
  admin = await newPage(browser);
  await signIn(admin, ADMIN.username, ADMIN.password);
});

test("signed-out visitors are sent to sign in, and the admin area is hidden", async ({ page }) => {
  await page.goto(`/${TEAM}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  const res = await page.goto("/ainzooalgown");
  expect(res?.status()).toBe(404);
});

test("admin adds a member and gets a one-time password", async () => {
  await admin.goto("/ainzooalgown/users");
  await admin.getByRole("button", { name: "Add user" }).click();
  await admin.fill("#new-name", "E2E Friend");
  await admin.fill("#new-username", MEMBER);
  await admin.getByRole("button", { name: "Add user" }).last().click();
  await expect(admin.getByText("User added")).toBeVisible();
  memberPassword = (await admin.locator("dd").nth(2).innerText()).trim();
  expect(memberPassword).toMatch(/^\w{4}-\w{4}-\w{4}$/);
  await admin.getByRole("button", { name: "Done" }).click();
  await expect(admin.getByText(`@${MEMBER}`)).toBeVisible();
});

test("admin writes notes, hides one and shares another", async () => {
  for (const slug of [TEAM, SECRET, PUBLIC]) {
    await admin.goto(`/${slug}`);
    await type(admin, `hello from admin in ${slug}`);
    await save(admin);
  }
  await admin.goto(`/${SECRET}`);
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin.getByText("Share settings…").click();
  await admin.getByRole("radio", { name: /Only me/ }).click();
  await expect(admin.getByRole("radio", { name: /Only me/ })).toHaveAttribute("aria-checked", "true");
  await admin.keyboard.press("Escape");

  await admin.goto(`/${PUBLIC}`);
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin.getByText("Share settings…").click();
  await admin.getByRole("switch").click();
  await admin.getByRole("radio", { name: /Can edit/ }).click();
  await expect(admin.getByRole("radio", { name: /Can edit/ })).toHaveAttribute("aria-checked", "true");
  shareLink = await admin.locator('input[aria-label="Share link"]').inputValue();
  expect(shareLink).toMatch(/\/s\/[\w-]{12}$/);
  await admin.keyboard.press("Escape");
});

test("member sees team notes only", async ({ browser }) => {
  member = await newPage(browser, true);
  await signIn(member, MEMBER, memberPassword);
  const home = await member.locator("main").innerText();
  expect(home).toContain(TEAM);
  expect(home).not.toContain(SECRET);
  await member.goto(`/${SECRET}`);
  await notFound(member);
  expect((await member.goto("/ainzooalgown"))?.status()).toBe(404);
  expect((await member.goto("/ainzooalgown/export"))?.status()).toBe(404);
  await member.goto(`/${TEAM}`);
  await type(member, " + member");
  await save(member);
});

test("unsaved changes come back after a reload", async () => {
  await member.goto(`/${TEAM}`);
  await type(member, " UNSAVED-DRAFT");
  await member.waitForTimeout(1000);
  member.once("dialog", (d) => d.accept());
  await member.reload();
  await member.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(editor(member)).toContainText("UNSAVED-DRAFT");
  await save(member);
});

test("saving a note empty asks first", async () => {
  await member.goto(`/${TEAM}`);
  await editor(member).click();
  await member.keyboard.press("Control+a");
  await member.keyboard.press("Delete");
  await member.waitForTimeout(300);
  await member.keyboard.press("Control+s");
  await expect(member.getByText("Save this note empty?")).toBeVisible();
  await member.getByRole("button", { name: "Keep editing" }).click();
  await member.keyboard.press("Control+z");
});

test("public link: edit without an account, then read only", async ({ browser }) => {
  const anon = await newPage(browser);
  await anon.goto(shareLink);
  await type(anon, " + anonymous");
  await save(anon);
  const headers = (await anon.request.get(shareLink)).headers();
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");

  await admin.goto(`/${PUBLIC}`);
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin.getByText("Share settings…").click();
  await admin.getByRole("radio", { name: /Can read/ }).click();
  await expect(admin.getByRole("radio", { name: /Can read/ })).toHaveAttribute("aria-checked", "true");
  await admin.keyboard.press("Escape");

  await anon.goto(shareLink);
  await expect(anon.locator(".editor-static")).toContainText("anonymous");
  await expect(editor(anon)).toHaveCount(0);
});

test("trash hides a note and restore brings it back", async () => {
  await admin.goto(`/ainzooalgown?q=${TEAM}`);
  await admin.getByRole("button", { name: `More actions for ${TEAM}` }).click();
  await admin.getByText("Move to trash…").click();
  await admin.getByRole("button", { name: "Move to trash" }).click();
  await expect(admin.getByText(/to the trash/)).toBeVisible();
  await member.goto(`/${TEAM}`);
  await notFound(member);
  await admin.goto("/ainzooalgown?filter=trash");
  await admin.getByRole("button", { name: `Restore ${TEAM}` }).click();
  await expect(admin.getByText(`Restored ${TEAM}`)).toBeVisible();
  await member.goto(`/${TEAM}`);
  await expect(editor(member)).toBeVisible();
});

test("command palette finds notes and switches theme", async () => {
  await admin.goto("/");
  await admin.keyboard.press("Control+k");
  await admin.keyboard.type(PUBLIC);
  await expect(admin.getByRole("option").filter({ hasText: PUBLIC }).first()).toBeVisible();
  await admin.keyboard.press("Enter");
  await expect(admin).toHaveURL(new RegExp(`/${PUBLIC}$`));
  await expect(editor(admin)).toBeVisible();

  const palette = admin.getByRole("listbox", { name: "Results" });
  await admin.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await admin.keyboard.type("light theme");
  await expect(palette.getByRole("option").first()).toContainText("light theme");
  await admin.keyboard.press("Enter");
  await expect(admin.locator("html")).toHaveClass(/light/);
  await expect(palette).toHaveCount(0);
  await admin.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await admin.keyboard.type("dark theme");
  await expect(palette.getByRole("option").first()).toContainText("dark theme");
  await admin.keyboard.press("Enter");
  await expect(admin.locator("html")).toHaveClass(/dark/);
});

test("disabling a member signs them out", async () => {
  await admin.goto("/ainzooalgown/users");
  await admin.getByRole("button", { name: `Actions for ${MEMBER}` }).click();
  await admin.getByText("Disable account").click();
  await expect(admin.getByText(/is disabled/)).toBeVisible();
  await member.goto(`/${TEAM}`);
  await expect(member).toHaveURL(/\/login/);
  await member.waitForLoadState("networkidle");
  await member.fill("#username", MEMBER);
  await member.fill("#password", memberPassword);
  await member.click("button[type=submit]");
  await expect(member.locator("#login-error")).toContainText("disabled");
});

test("activity log and backup", async () => {
  await admin.goto("/ainzooalgown/activity");
  const log = admin.locator("main:not([aria-busy])");
  await expect(log).toContainText("added user");
  await expect(log).toContainText("disabled user");
  const res = await admin.request.get("/ainzooalgown/export");
  const body = await res.text();
  const data = JSON.parse(body);
  expect(Array.isArray(data.notes)).toBe(true);
  expect(body).not.toContain("scrypt$");
});
