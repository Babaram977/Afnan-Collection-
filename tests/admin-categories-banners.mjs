// Category and banner management (2026-11-22 audit) at 390 and 1440 px: format hints and browser
// validation instead of a bare "Invalid input"; a category's slug cannot be edited into a second
// category; editing can be cancelled; a double tap creates one banner, not two; banner rows show the
// photograph and whether it is published; the phone form fits its card; edits preserve existing data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const PNG = await readFile("public/brand/afnan-collection-logo.png");
const PHOTO = "/media/bbbbbbbb-0000-4000-8000-000000000001.png";
const BANNER = "cccccccc-0000-4000-8000-000000000001";
const { mf, db } = await createTestApp({
  port: 8787,
  bindings: {
    APP_ENV: "acceptance",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
    ADMIN_AUTH_MODE: "password",
  },
});
let checks = 0;
const eq = (a, b, m) => {
  assert.deepEqual(a, b, m);
  checks++;
};
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const browser = await chromium.launch();
try {
  await (
    await mf.getR2Bucket("MEDIA")
  ).put(PHOTO.slice(7), PNG, {
    httpMetadata: { contentType: "image/png" },
  });
  await db
    .prepare(
      "INSERT INTO banners(id,title,href,image_url,active) VALUES(?,'Fixture Banner','/shop',?,1)",
    )
    .bind(BANNER, PHOTO)
    .run();
  for (const width of [390, 1440]) {
    await db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM session")]);
    const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
    for (const s of statements) await db.prepare(s).run();
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 90 : 91}` },
    });
    await page.goto(`${ORIGIN}/admin?setup=${token}`);
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    const form = page.locator("form").first();
    const save = form.getByRole("button", { name: "Save changes", exact: true });
    const fits = async (where) => {
      const card = await form.boundingBox();
      const widest = await form.evaluate((f) =>
        Math.max(
          ...[...f.querySelectorAll("input,button,select")].map(
            (e) => e.getBoundingClientRect().right,
          ),
        ),
      );
      ok(widest <= card.x + card.width + 0.5, `${where} controls fit the card at ${width}`);
      ok(
        !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `${where}: no horizontal overflow at ${width}`,
      );
    };

    // Categories
    await openAdminSection(page, "Categories");
    await page.waitForLoadState("networkidle");
    eq(await form.locator("h3").innerText(), "Add a category");
    const slug = page.getByLabel("Category slug");
    ok(
      (await page.locator("#edit-categories-slug-hint").innerText()).includes("Lowercase letters"),
      "Slug format explained",
    );
    await slug.fill("Toys & Games");
    await page.getByLabel("Display label").fill(`Toys and games ${width}`);
    let posts = 0;
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/admin/") && posts++);
    await save.click();
    ok((await slug.evaluate((e) => e.validationMessage)) !== "", "Browser explains the bad slug");
    eq(posts, 0, "Invalid slug is not sent");
    await slug.fill(`games-${width}`);
    await save.click();
    await page.getByRole("status").filter({ hasText: "Category saved." }).waitFor();
    eq(await page.getByRole("alert").count(), 0, "No alert after a successful save");
    eq(await slug.inputValue(), "", "Form clears after a successful save");
    if (width === 390) {
      const [card, button] = await Promise.all([form.boundingBox(), save.boundingBox()]);
      ok(button.width > card.width * 0.8, "Save button spans the phone form");
    }
    await fits("Category form");
    // Edit: label changes, slug is locked, and no second category appears.
    const before = await db.prepare("SELECT COUNT(*) n FROM categories").first("n");
    await page
      .locator("tr", { hasText: `Toys and games ${width}` })
      .getByRole("button", { name: "Edit" })
      .click();
    eq(await form.locator("h3").innerText(), "Edit category");
    ok(!(await slug.isEditable()), "Slug is read-only when editing");
    eq(await slug.inputValue(), `games-${width}`);
    await page.getByLabel("Display label").fill(`Toys & games ${width}`);
    await save.click();
    await page.getByRole("status").filter({ hasText: "Category saved." }).waitFor();
    eq(await db.prepare("SELECT COUNT(*) n FROM categories").first("n"), before, "No new category");
    eq(
      await db
        .prepare("SELECT label FROM categories WHERE slug=?")
        .bind(`games-${width}`)
        .first("label"),
      `Toys & games ${width}`,
      "Label updated in place",
    );
    await page.locator("tr", { hasText: "Clothing" }).getByRole("button", { name: "Edit" }).click();
    await form.getByRole("button", { name: "Cancel editing" }).click();
    eq(await form.locator("h3").innerText(), "Add a category", "Cancel returns to adding");
    eq(await slug.inputValue(), "", "Cancel clears the form");

    // Banners
    await openAdminSection(page, "Banners");
    await page.waitForLoadState("networkidle");
    eq(await form.locator("h3").innerText(), "Add a banner");
    await fits("Banner form");
    const row = page.locator('section[aria-label="banners records"] tr', {
      hasText: "Fixture Banner",
    });
    const preview = row.locator("img");
    await preview.waitFor();
    await preview.evaluate((img) => img.decode());
    ok((await preview.evaluate((img) => img.naturalWidth)) > 0, "Banner row shows its photograph");
    ok((await row.innerText()).includes("Published"), "Banner row shows it is published");
    const href = page.getByLabel("Shop or product link");
    eq(await href.getAttribute("placeholder"), "e.g. /shop?category=clothing");
    await page.getByLabel("Title").fill("Fixture New Banner");
    await href.fill("shop");
    posts = 0;
    await save.click();
    ok((await href.evaluate((e) => e.validationMessage)) !== "", "Browser explains the bad link");
    eq(posts, 0, "Invalid link is not sent");
    await href.fill("/shop?category=clothing");
    let bannerPosts = 0;
    await page.route("**/api/admin/banners", async (route) => {
      if (route.request().method() === "POST") {
        bannerPosts++;
        await new Promise((r) => setTimeout(r, 400)); // a slow phone network
      }
      await route.continue();
    });
    await save.evaluate((b) => {
      b.click();
      b.click();
    });
    await page.getByRole("status").filter({ hasText: "Banner saved." }).waitFor();
    await page.unroute("**/api/admin/banners");
    eq(bannerPosts, 1, "One request for a double tap");
    eq(
      await db
        .prepare("SELECT COUNT(*) n FROM banners WHERE title='Fixture New Banner'")
        .first("n"),
      1,
      "Exactly one banner created",
    );
    await db.prepare("DELETE FROM banners WHERE title='Fixture New Banner'").run();
    // Editing a banner's title keeps its photograph, link and visibility.
    await row.getByRole("button", { name: "Edit" }).click();
    eq(await form.locator("h3").innerText(), "Edit banner");
    await page.getByLabel("Title").fill(`Fixture Banner ${width}`);
    await save.click();
    await page.getByRole("status").filter({ hasText: "Banner saved." }).waitFor();
    eq(
      await db
        .prepare("SELECT title,href,image_url,active FROM banners WHERE id=?")
        .bind(BANNER)
        .first(),
      { title: `Fixture Banner ${width}`, href: "/shop", image_url: PHOTO, active: 1 },
      "Existing banner data preserved",
    );
    await db.prepare("UPDATE banners SET title='Fixture Banner' WHERE id=?").bind(BANNER).run();
    if (process.env.SHOTS && width === 390) {
      await page.reload();
      await openAdminSection(page, "Banners");
      await preview.waitFor();
      await page.screenshot({ path: `${process.env.SHOTS}/banners-390.png`, fullPage: true });
    }
    await page.close();
  }
  console.log(`PASS: ${checks} category and banner management checks at 390/1440 px`);
} finally {
  await browser.close();
  await mf.dispose();
}
