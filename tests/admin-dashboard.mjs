// Administrator dashboard layout and workflow (password mode) on phone and desktop widths:
// compact header with the original logo, section navigation, statistics grid, product search and
// filters, low-stock accuracy, no horizontal overflow, sign-out and session expiry.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const SECTIONS = [
  "Overview",
  "Orders",
  "Payments",
  "Customers",
  "Products",
  "Inventory",
  "Categories",
  "Zones",
  "Banners",
  "Content",
  "Business",
  "Audit",
];
const { mf, db } = await createTestApp({
  port: 8787,
  bindings: {
    APP_ENV: "acceptance",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
    ADMIN_AUTH_MODE: "password",
  },
});
const browser = await chromium.launch();
let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const noOverflow = async (page, where) =>
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    `No horizontal overflow: ${where}`,
  );
try {
  // Genuine-looking catalogue rows are not needed: neutral fixtures exercise search and filters.
  await db.batch([
    db.prepare(
      "INSERT INTO products(id,slug,name,category,status) VALUES('p1','fixture-alpha','Fixture Alpha','clothing','active'),('p2','fixture-beta','Fixture Beta','shoes','draft'),('p3','fixture-old','Fixture Old','toys','archived')",
    ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,stock,low_stock) VALUES('v1','p1','FX-A-1',100000,2,3),('v2','p2','FX-B-1',200000,10,3),('v3','p3','FX-O-1',50000,0,3)",
    ),
  ]);
  for (const width of [390, 1440]) {
    await db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM session")]);
    const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
    for (const s of statements) await db.prepare(s).run();
    // Better Auth allows 3 sign-ins per 10 s per IP (in-memory): give each viewport its own IP.
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 10 : 11}` },
    });

    // Storefront header keeps its full brand height; the admin header is compact.
    await page.goto(`${ORIGIN}/`);
    const storeHeader = await page.locator("header").first().boundingBox();
    ok(storeHeader.height >= 140, `Storefront header unchanged at ${width}`);

    await page.goto(`${ORIGIN}/admin?setup=${token}`);
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();

    const header = await page.locator("header").first().boundingBox();
    ok(header.height <= 72, `Compact admin header at ${width} (${header.height}px)`);
    const logo = page.locator('header img[data-brand-logo="original"]');
    const shape = await logo.evaluate((img) => ({
      src: img.getAttribute("src"),
      ratio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    }));
    ok(shape.src === "/brand/afnan-collection-logo.png", "Official logo file");
    ok(Math.abs(shape.ratio - 460 / 546) < 0.01, "Logo proportions preserved");
    ok(await page.getByRole("button", { name: "Sign out" }).isVisible(), "Sign out reachable");

    // Statistics: four tiles, two per row on phones, one row on desktop.
    const tiles = page.locator('section[aria-label="Overview"] .grid > div');
    assert.equal(await tiles.count(), 4);
    const [a, b, c] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()));
    ok(Math.abs(a.y - b.y) < 2, "First two tiles share a row");
    ok(width === 390 ? c.y > a.y + 10 : Math.abs(c.y - a.y) < 2, `Tile grid layout at ${width}`);
    ok(a.height < 120, "Tiles are compact");
    const low = await page.locator('section[aria-label="Overview"] li').allInnerTexts();
    ok(
      low.length === 1 && low[0].includes("Fixture Alpha"),
      "Low stock excludes archived products",
    );
    await noOverflow(page, `overview ${width}`);

    if (width === 390) {
      ok(
        await page.getByRole("button", { name: "Admin sections" }).isVisible(),
        "Phone has a Sections menu",
      );
      await page.getByRole("button", { name: "Admin sections" }).click();
      const dialog = page.getByRole("dialog");
      for (const name of SECTIONS)
        ok(await dialog.getByRole("button", { name, exact: true }).isVisible(), `${name} listed`);
      await noOverflow(page, "sections panel");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    } else {
      ok(
        !(await page.getByRole("button", { name: "Admin sections" }).isVisible()),
        "Desktop has no Sections menu",
      );
      const nav = page.getByRole("navigation", { name: "Administration", exact: true });
      for (const name of SECTIONS)
        ok(await nav.getByRole("button", { name, exact: true }).isVisible(), `${name} in row`);
    }

    // Every section opens without horizontal overflow.
    for (const name of SECTIONS) {
      await openAdminSection(page, name);
      await page.waitForLoadState("networkidle");
      await noOverflow(page, `${name} ${width}`);
    }

    // Product search and filters.
    await openAdminSection(page, "Products");
    const cards = page.locator("[data-product-list] li h2");
    await cards.first().waitFor();
    assert.equal(await cards.count(), 4, "Harness romper plus three fixtures");
    await page.getByLabel("Search products by name or SKU").fill("beta");
    ok((await cards.allInnerTexts()).join() === "Fixture Beta", "Search by name");
    await page.getByLabel("Search products by name or SKU").fill("FX-A");
    ok((await cards.allInnerTexts()).join() === "Fixture Alpha", "Search by SKU");
    await page.getByLabel("Search products by name or SKU").fill("");
    await page.getByLabel("Filter by visibility").selectOption("draft");
    ok((await cards.allInnerTexts()).join() === "Fixture Beta", "Visibility filter");
    await page.getByLabel("Filter by visibility").selectOption("all");
    await page.getByLabel("Filter by category").selectOption("toys");
    ok((await cards.allInnerTexts()).join() === "Fixture Old", "Category filter");
    await page.getByLabel("Filter by category").selectOption("all");

    // Content is not hidden under Safari's bottom bar: the page ends with bottom padding.
    const pad = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector("[data-admin-page]")).paddingBottom),
    );
    ok(pad >= 90, `Bottom safe padding (${pad}px)`);

    // Session expiry and sign-out.
    await db.prepare("DELETE FROM session").run();
    await page.reload();
    await page.locator("[data-admin-password-signin]").waitFor();
    ok(true, "Expired session returns to sign-in");
    await db.prepare("DELETE FROM rate_limits").run();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    if (process.env.ADMIN_SCREENSHOTS) {
      await openAdminSection(page, "Overview");
      await page.screenshot({ path: `${process.env.ADMIN_SCREENSHOTS}/admin-${width}.png` });
    }
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.locator("[data-admin-password-signin]").waitFor();
    ok(true, "Sign out returns to sign-in");
    await page.close();
  }
  console.log(`PASS: ${checks} administrator dashboard layout and workflow checks at 390/1440 px`);
} finally {
  await browser.close();
  await mf.dispose();
}
