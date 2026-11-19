// Navigation uses real local password sessions and DB roles, without test auth bypasses.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";
const { mf, db } = await createTestApp({
  port: 8787,
  bindings: {
    APP_ENV: "acceptance",
    ADMIN_AUTH_MODE: "password",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
  },
});
const browser = await chromium.launch();
const output = process.env.ADMIN_NAV_REVIEW_DIR || "/tmp/afnan-admin-navigation";
await mkdir(output, { recursive: true });
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const email = "admin@afnancollectionkn.com",
  password = "Navigation fixture passphrase 2026";
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${ORIGIN}/shop`);
    await page.waitForLoadState("networkidle");
    if (width < 1024) await page.getByRole("button", { name: "Open menu" }).click();
    check(
      (await page.getByRole("link", { name: "Store Management", exact: true }).count()) === 0,
      `Guest has no management link at ${width}`,
    );
    if (width < 1024) {
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
  }
  const { statements, token } = provisionPasswordAdmin({ email });
  for (const s of statements) await db.prepare(s).run();
  await page.goto(`${ORIGIN}/admin?setup=${token}`);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();
  async function signIn() {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  }
  await signIn();
  for (const width of [320, 390, 1440]) {
    await db.prepare("DELETE FROM rate_limits").run();
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${ORIGIN}/admin`);
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    const header = page.locator("header");
    check((await header.boundingBox()).height === 65, `Admin header stays 65px at ${width}`);
    check(
      await header.getByRole("link", { name: "Store Management", exact: true }).isVisible(),
      `Management destination at ${width}`,
    );
    check(
      (await header.getByRole("link", { name: /^Cart,/ }).count()) === 0,
      `No cart in admin at ${width}`,
    );
    check(
      (await header.getByRole("button", { name: "Open menu" }).count()) === 0,
      `No shopping menu in admin at ${width}`,
    );
    check(
      (await header.getByRole("navigation", { name: "Main", exact: true }).count()) === 0,
      `No shopping nav in admin at ${width}`,
    );
    check(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
      `No admin overflow at ${width}`,
    );
    for (const section of [
      "Products",
      "Inventory",
      "Orders",
      "Categories",
      "Banners",
      "Business",
    ]) {
      await openAdminSection(page, section);
      checks++;
    }
    await page.screenshot({ path: `${output}/admin-${width}.png` });
    assert.deepEqual(
      (
        await new AxeBuilder({ page })
          .include("header")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
      [],
    );
    checks++;
    const before = (await context.cookies()).filter((c) => c.name.includes("session"));
    check(before.length > 0, "Real session cookie exists");
    await header.getByRole("link", { name: "Back to Store", exact: true }).click();
    await page.waitForURL(`${ORIGIN}/`);
    const nav = page.getByRole("navigation", {
      name: width < 1024 ? "Mobile" : "Main",
      exact: true,
    });
    if (width < 1024) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(nav.getByRole("link", { name: "Store Management", exact: true })).toBeVisible();
    checks++;
    await page.screenshot({ path: `${output}/store-menu-${width}.png` });
    await nav.getByRole("link", { name: "Store Management", exact: true }).click();
    await page.waitForURL("**/admin");
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    check(
      JSON.stringify((await context.cookies()).filter((c) => c.name.includes("session"))) ===
        JSON.stringify(before),
      "Navigation preserves session cookie",
    );
    check(
      (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 200,
      "Server still authorizes same administrator session",
    );
  }
  await db.prepare("DELETE FROM rate_limits").run();
  const management = page.getByRole("link", { name: "Store Management", exact: true });
  await page.goto(`${ORIGIN}/account`);
  await expect(management).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(management).toHaveCount(0);
  checks++;
  await page.goto(`${ORIGIN}/admin`);
  await signIn();
  await page.getByRole("link", { name: "Back to Store", exact: true }).click();
  await expect(management).toBeVisible();
  const userId = await db.prepare("SELECT id FROM user WHERE email=?").bind(email).first("id");
  await db.prepare("DELETE FROM staff WHERE user_id=?").bind(userId).run();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForLoadState("networkidle");
  await expect(management).toHaveCount(0);
  checks++;
  check(
    (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 401,
    "Staff revocation invalidates primary session server-side",
  );
  // Existing triggers correctly revoke the primary session when staff membership changes.
  // Sign in without staff to exercise a genuine authenticated non-administrator.
  await page.goto(`${ORIGIN}/admin`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText("Sign in with an authorized administrator account to continue.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Back to Store", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await expect(management).toHaveCount(0);
  checks++;
  const meResponse = await page.request.get(`${ORIGIN}/api/me`);
  check(meResponse.status() === 200, "Customer identity request succeeds");
  const me = await meResponse.json();
  check(Boolean(me.userId) && !me.role, "Authenticated customer has no privileged link or role");
  check(
    (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 403,
    "Authenticated non-staff denied server-side",
  );
  const denied = await page.request.post(`${ORIGIN}/api/admin/inventory`, {
    headers: { Origin: ORIGIN },
    data: { variantId: "not-a-variant", delta: 1, reason: "denial check" },
  });
  check(denied.status() === 403, "Unauthorized stock write denied before mutation");
  await db.prepare("INSERT INTO staff(user_id,role) VALUES(?,'fulfilment')").bind(userId).run();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForLoadState("networkidle");
  await expect(management).toHaveCount(0);
  checks++;
  check(
    (await (await page.request.get(`${ORIGIN}/api/me`)).json()).role === "fulfilment",
    "Non-admin staff role is genuine",
  );
  await db.prepare("UPDATE staff SET role='admin' WHERE user_id=?").bind(userId).run();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForLoadState("networkidle");
  await expect(management).toHaveCount(0);
  checks++;
  check(
    (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 401,
    "Role changes require a fresh session; no client privilege escalation",
  );
  const h = await (await page.request.get(`${ORIGIN}/api/health`)).json();
  check(!h.checkoutEnabled && !h.paymentsEnabled, "Checkout and payments remain disabled");
  await context.close();
  console.log(
    `PASS: ${checks} administrator/customer navigation, mobile, session continuity and authorization checks`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
