import { Page, expect, test } from "@playwright/test";

import { ADMIN, editor, save, signIn } from "./helpers";
import { PREFIX } from "./safety";

const WIDE = `${PREFIX}wide-table`;
const BLOCKS = `${PREFIX}blocks`;
const SMALL = `${PREFIX}small-table`;
const SHOTS = process.env.E2E_SCREENSHOTS;

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  await signIn(page, ADMIN.username, ADMIN.password);
});

/** Opens the "/" menu at the end of the note and picks an option by its label. */
async function slash(query: string, option: string | RegExp) {
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(`/${query}`);
  const item = page.locator(".component-picker-menu [role=option]", { hasText: option }).first();
  await expect(item).toBeVisible();
  await item.click();
  await page.waitForTimeout(200);
}

test("wide tables keep their columns and scroll sideways; small ones fill the sheet", async () => {
  await page.goto(`/${SMALL}`);
  await page.waitForLoadState("networkidle");
  await slash("2x2", "2×2 Table");
  const small = page.locator(".editor-table-scrollable-wrapper");
  const smallBox = await small.evaluate((el) => ({ wrap: el.clientWidth, table: el.querySelector("table")!.offsetWidth }));
  expect(Math.abs(smallBox.table - smallBox.wrap)).toBeLessThan(3);
  await expect(small).not.toHaveAttribute("data-overflow", /.+/);

  await page.goto(`/${WIDE}`);
  await page.waitForLoadState("networkidle");
  await slash("3x10", "3×10 Table");
  const wide = page.locator(".editor-table-scrollable-wrapper");

  const wideBox = await wide.evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    cell: el.querySelector("td,th")!.getBoundingClientRect().width,
  }));
  expect(wideBox.scroll).toBeGreaterThan(wideBox.client + 100);
  expect(wideBox.cell).toBeGreaterThanOrEqual(127);
  await expect(wide).toHaveAttribute("data-overflow", "right");

  // Long text wraps inside its column instead of stretching the table forever.
  await wide.locator("td,th").first().click();
  await page.keyboard.type("A long sentence that keeps going and going so it has to wrap onto several lines in its cell.");
  const firstCell = await wide.locator("td,th").first().evaluate((el) => el.getBoundingClientRect().width);
  expect(firstCell).toBeLessThan(400);

  await wide.evaluate((el) => el.scrollTo({ left: 200 }));
  await expect(wide).toHaveAttribute("data-overflow", "both");
  await wide.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(wide).toHaveAttribute("data-overflow", "left");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wide-table.png`, fullPage: true });

  await save(page);
  await page.goto(`/${WIDE}/view`);
  const view = page.locator(".editor-table-scrollable-wrapper");
  const scrolls = await view.evaluate((el) => el.scrollWidth > el.clientWidth + 100);
  expect(scrolls).toBe(true);
});

test("the / menu is grouped and finds the new blocks", async () => {
  await page.goto(`/${BLOCKS}`);
  await page.waitForLoadState("networkidle");
  await editor(page).click();
  await page.keyboard.type("/");
  const menu = page.locator(".component-picker-menu");
  for (const section of ["Basic", "Lists", "Insert", "Code", "Math", "Format"]) {
    await expect(menu.locator(".picker-section", { hasText: section })).toBeVisible({ visible: true }).catch(async () => {
      await expect(menu.locator(".picker-section", { hasText: section })).toHaveCount(1);
    });
  }
  await expect(menu.getByRole("option", { name: "Heading 4" })).toHaveCount(1);
  await expect(menu.getByRole("option", { name: "Toggle" })).toHaveCount(1);
  // Language variants appear once you type.
  await page.keyboard.type("pyth");
  await expect(menu.getByRole("option", { name: "Code: Python" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/slash-menu.png` });
  await page.keyboard.press("Escape");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
});

test("callouts: type inside, step out with Enter, click the icon to change type", async () => {
  await slash("callout", /^Callout$/);
  await page.keyboard.type("Remember the milk");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Outside the callout");

  const callout = page.locator(".editor-input .editor-callout");
  await expect(callout).toHaveCount(1);
  await expect(callout).toContainText("Remember the milk");
  await expect(callout).not.toContainText("Outside the callout");
  await expect(callout).toHaveAttribute("data-variant", "note");
  await callout.locator(".editor-callout-icon").click();
  await expect(callout).toHaveAttribute("data-variant", "tip");
});

test("toggles: title, hidden body, remembered open state, and read-only view", async () => {
  await page.keyboard.press("Enter");
  await slash("toggle", "Toggle");
  await page.keyboard.type("Spoilers");
  await page.keyboard.press("Enter");
  await page.keyboard.type("The butler did it");

  const toggle = page.locator(".editor-input .editor-toggle");
  const body = toggle.locator(".editor-toggle-content");
  await expect(toggle.locator(".editor-toggle-title")).toContainText("Spoilers");
  await expect(body).toBeVisible();
  await toggle.locator(".editor-toggle-chevron").click();
  await expect(body).toBeHidden();

  await save(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".editor-input .editor-toggle .editor-toggle-content")).toBeHidden();
  await page.locator(".editor-input .editor-toggle-chevron").click();
  await expect(page.locator(".editor-input .editor-toggle .editor-toggle-content")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/blocks.png`, fullPage: true });

  await page.goto(`/${BLOCKS}/view`);
  const details = page.locator("details.editor-toggle");
  await expect(details.locator("summary")).toContainText("Spoilers");
  await expect(page.locator("aside.editor-callout[data-variant=tip]")).toContainText("Remember the milk");
  await expect(details.locator(".editor-toggle-content")).toBeHidden();
  await details.locator("summary").click();
  await expect(details.locator(".editor-toggle-content")).toBeVisible();
});

test("[[ links another note", async () => {
  await page.goto(`/${BLOCKS}`);
  await page.waitForLoadState("networkidle");
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`[[${PREFIX}wide`);
  const option = page.locator(".note-link-menu [role=option]", { hasText: WIDE });
  await expect(option).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(`.editor-input a[href="/${WIDE}"]`)).toHaveText(WIDE);
});

test("left toolbar shows the current block and switches block types", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/${PREFIX}rail`);
  await page.waitForLoadState("networkidle");
  await editor(page).click();
  await page.keyboard.type("Rail heading");

  const rail = page.getByRole("navigation", { name: "Blocks" });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("button", { name: "Paragraph" })).toHaveAttribute("aria-pressed", "true");

  await rail.getByRole("button", { name: "Heading 2" }).click();
  await expect(page.locator(".editor-input h2")).toHaveText("Rail heading");
  await expect(rail.getByRole("button", { name: "Heading 2" })).toHaveAttribute("aria-pressed", "true");

  // Clicking the active style again goes back to a paragraph, like Word.
  await rail.getByRole("button", { name: "Heading 2" }).click();
  await expect(page.locator(".editor-input h2")).toHaveCount(0);

  await rail.getByRole("button", { name: "Bulleted list" }).click();
  await expect(page.locator(".editor-input ul li")).toHaveText("Rail heading");
  await rail.getByRole("button", { name: "Bulleted list" }).click();
  await expect(page.locator(".editor-input ul")).toHaveCount(0);

  await rail.getByRole("button", { name: "Callout" }).click();
  await expect(page.locator(".editor-input .editor-callout")).toHaveCount(1);
  await expect(rail.getByRole("button", { name: "Callout" })).toHaveAttribute("aria-pressed", "true");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rail.png` });

  // Narrow screens keep the / menu instead.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(rail).toBeHidden();
});
