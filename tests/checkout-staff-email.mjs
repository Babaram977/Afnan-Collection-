// A staff member shopping in the browser where they are signed into the admin dashboard: checkout
// must never prefill the staff email, the customer's email stays editable and is what the order
// records, and early typing survives the account check. Then the admin order card expands its
// details inside the card and collapses again. 390 and 1280 px.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const { mf, db, variantId } = await createTestApp({
  port: 8787,
  bindings: {
    CHECKOUT_ENABLED: "true",
    PAYMENT_MODE: "disabled",
    ADMIN_AUTH_MODE: "password",
    LEGACY_ZONE_ORDERS: "",
  },
});
let checks = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const eq = (a, b, m) => {
  assert.deepEqual(a, b, m);
  checks++;
};
const browser = await chromium.launch();
try {
  await db
    .prepare("UPDATE variants SET price_kobo=250000, sale_price_kobo=NULL, stock=50 WHERE id=?")
    .bind(variantId)
    .run();
  for (const width of [390, 1280]) {
    await db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM session")]);
    const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
    for (const s of statements) await db.prepare(s).run();
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 120 : 121}` },
    });
    await page.goto(`${ORIGIN}/admin?setup=${token}`);
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();

    // Same browser, still signed in as the administrator: shop as a customer.
    await page.goto(`${ORIGIN}/shop`);
    await page
      .getByRole("link", { name: /Test fixture romper/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.locator("[data-added-to-cart]").waitFor();
    const me = page.waitForResponse((r) => r.url().endsWith("/api/me"));
    await page.goto(`${ORIGIN}/checkout`);
    const meBody = await (await me).json();
    eq([meBody.email, meBody.staff], [EMAIL, true], "the session is the staff account");
    await page.waitForLoadState("networkidle");
    const email = page.getByLabel("Email", { exact: true });
    eq(await email.inputValue(), "", `staff email is not prefilled at ${width}`);
    ok(await email.isEditable(), "customer email is editable");
    const customer = `customer-${width}@example.com`;
    await email.fill(customer);
    await page.getByLabel("Full name", { exact: true }).fill("Guest Customer");
    await page.getByLabel("Phone", { exact: true }).fill("08000000000");
    await page.getByLabel("Street address", { exact: true }).fill("Fixture address, not real");
    await page.getByLabel("City", { exact: true }).fill("Kano");
    await page.getByLabel("State", { exact: true }).fill("Kano");
    await page.getByRole("button", { name: "Prepare order", exact: true }).click();
    await page
      .getByRole("heading", { name: "Order prepared" })
      .waitFor({ timeout: 20000 })
      .catch(async (e) => {
        console.error("PAGE:", (await page.locator("main").innerText()).slice(0, 1500));
        throw e;
      });
    const order = await db
      .prepare("SELECT id,email FROM orders ORDER BY created_at DESC LIMIT 1")
      .first();
    eq(order.email, customer, "order records the customer's email, not the staff email");

    // Admin order card: details open inside the selected card and close again.
    await page.goto(`${ORIGIN}/admin`);
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    await openAdminSection(page, "Orders");
    const toggle = page.getByRole("button", { name: "View purchased items and delivery" }).first();
    await toggle.click();
    const hide = page.getByRole("button", { name: "Hide order details" });
    await hide.waitFor();
    eq(await hide.getAttribute("aria-expanded"), "true", "toggle reports expanded");
    const card = hide.locator("xpath=ancestor::li[1]");
    ok(
      (await card.locator("[data-order-item]").count()) > 0,
      `purchased items render inside the selected card at ${width}`,
    );
    ok(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
      `no horizontal overflow at ${width}`,
    );
    await hide.click();
    eq(await page.getByRole("button", { name: "Hide order details" }).count(), 0, "collapses");
    await page.close();
  }
  console.log(`PASS: ${checks} staff-browser checkout email and inline order card checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
