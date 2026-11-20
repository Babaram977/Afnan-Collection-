import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";

const { mf, db, zoneId } = await createTestApp({
  port: 8787,
  bindings: { ADMIN_AUTH_MODE: "password", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
const browser = await chromium.launch();
const output = process.env.ACCOUNT_RETIREMENT_REVIEW_DIR || "/tmp/afnan-account-retirement";
await mkdir(output, { recursive: true });
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  // Real legacy customer session and historical records, in isolated local fixtures only.
  const customer = new Client(mf);
  const me = await customer.signIn(db, "retained-customer@example.invalid");
  await db
    .prepare(
      'INSERT INTO addresses(id,user_id,label,data) VALUES (\'retained-address\',?,\'Home\',\'{"street":"Fixture street","city":"Kano"}\')',
    )
    .bind(me.userId)
    .run();
  await db
    .prepare(
      "INSERT INTO orders(id,owner,user_id,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,status) VALUES ('retained-order',?,?,'retained-key','fixture-hash','retained-customer@example.invalid','{}','{}',?,0,'paid')",
    )
    .bind(me.userId, me.userId, zoneId)
    .run();
  const snapshot = async () => {
    const rows = {};
    for (const table of [
      "user",
      "account",
      "session",
      "addresses",
      "orders",
      "inventory_movements",
    ])
      rows[table] = (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
    return rows;
  };
  const before = await snapshot();
  for (const path of ["/account", "/account?order=retained-order", "/account?returnTo=%2Fadmin"]) {
    const response = await mf.dispatchFetch(`${ORIGIN}${path}`, { redirect: "manual" });
    check(response.status === 302, `Old account bookmark redirects: ${path}`);
    check(
      new URL(response.headers.get("location"), ORIGIN).pathname === "/",
      "Redirect stays on storefront",
    );
  }
  for (const signedIn of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (signedIn)
      await context.addCookies(
        [...customer.cookies].map(([name, value]) => ({ name, value, url: ORIGIN })),
      );
    const page = await context.newPage();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${ORIGIN}/account?order=retained-order#addresses`);
      await page.waitForURL((url) => url.pathname === "/" && url.search === "");
      check(
        await page.locator('header img[data-brand-logo="original"]').isVisible(),
        `Original logo at ${width}`,
      );
      check(
        (await page.getByRole("heading", { name: "Your account", exact: true }).count()) === 0,
        "No account screen",
      );
      if (width < 1024) await page.getByRole("button", { name: "Open menu" }).click();
      const nav = page.getByRole("navigation", {
        name: width < 1024 ? "Mobile" : "Main",
        exact: true,
      });
      check((await nav.locator('a[href^="/account"]').count()) === 0, "No account navigation");
      check(
        (await nav.getByRole("link", { name: "Store Management", exact: true }).count()) === 0,
        "Customers have no privileged entry point",
      );
      for (const name of ["Shop", "About", "Contact", "Policies"])
        check(
          await nav.getByRole("link", { name, exact: true }).isVisible(),
          `${name} remains accessible`,
        );
      await nav.getByRole("link", { name: "Shop", exact: true }).click();
      await page.waitForURL(`${ORIGIN}/shop`);
      if (width < 1024) await expect(page.getByRole("dialog")).toHaveCount(0);
      check(
        await page
          .getByRole("link", { name: /Test fixture romper/ })
          .first()
          .isVisible(),
        "Catalogue remains available",
      );
      check((await page.locator('header a[href="/cart"]').count()) === 1, "Shopping bag preserved");
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No overflow at ${width}`,
      );
      if (width === 390 && !signedIn)
        await page.screenshot({ path: `${output}/storefront-390.png` });
    }
    await page.goto(`${ORIGIN}/checkout`);
    check(
      await page
        .getByText("Ordering is not enabled. No real orders or payments can be submitted.", {
          exact: true,
        })
        .isVisible(),
      "Checkout stays disabled",
    );
    check(
      (await page.getByLabel("Saved address", { exact: true }).count()) === 0,
      "No saved-address UI",
    );
    if (signedIn) {
      check(
        (await (await page.request.get(`${ORIGIN}/api/me`)).json()).userId === me.userId,
        "Redirect never signs out existing customers",
      );
      check(
        (await (await page.request.get(`${ORIGIN}/api/addresses`)).json()).length === 1,
        "Existing address retained",
      );
      check(
        (await (await page.request.get(`${ORIGIN}/api/orders`)).json()).some(
          (o) => o.id === "retained-order",
        ),
        "Historical order retained",
      );
      check(
        (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 403,
        "Customer still denied administration",
      );
    }
    await context.close();
  }
  assert.deepEqual(
    await snapshot(),
    before,
    "Account retirement must not mutate customer/session/history records",
  );
  checks++;
  const health = (await customer.request("/health")).body;
  check(
    health.checkoutEnabled === false && health.paymentsEnabled === false,
    "Commerce switches remain disabled",
  );
  console.log(`PASS: ${checks} account-retirement, record-retention, browsing and mobile checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
