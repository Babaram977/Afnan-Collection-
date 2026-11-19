import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";
const { mf, db } = await createTestApp({
  port: 8787,
  bindings: { ADMIN_AUTH_MODE: "password", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
const browser = await chromium.launch();
const out = process.env.SINGLE_LOGIN_REVIEW_DIR || "/tmp/afnan-single-login";
await mkdir(out, { recursive: true });
let checks = 0;
const check = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const email = "admin@afnancollectionkn.com",
  password = "Browser authentication fixture 2026";
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/admin`);
  await page.getByRole("heading", { name: "Administrator sign in" }).waitFor();
  check(
    await page.getByLabel("Password", { exact: true }).isVisible(),
    "Website branded password form visible",
  );
  check(
    (await page.locator('header img[data-brand-logo="original"]').count()) === 1,
    "Original logo retained",
  );
  check(
    (await page.getByRole("button", { name: "Open menu" }).count()) === 0,
    "No customer menu on admin login",
  );
  await page.screenshot({ path: `${out}/password-login-390.png` });
  assert.deepEqual(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
    [],
  );
  checks++;
  const provision = provisionPasswordAdmin({ email });
  for (const sql of provision.statements) await db.prepare(sql).run();
  const client = new Client(mf);
  check(
    (await client.request("/admin-setup", "POST", { token: provision.token, password })).status ===
      200,
    "Local controlled setup",
  );
  const otp = await client.signIn(db, email);
  check(otp.role === null, "OTP session is not administrator authentication");
  await context.addCookies(
    [...client.cookies].map(([name, value]) => ({
      name,
      value,
      url: ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    })),
  );
  await page.goto(`${ORIGIN}/admin`);
  await page
    .getByText("Sign in with an authorized administrator account to continue.", { exact: true })
    .waitFor();
  check(
    (await page.getByRole("navigation", { name: "Administration", exact: true }).count()) === 0,
    "Other session methods cannot open management",
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  check(
    (await page.getByRole("heading", { name: "Administrator sign in" }).count()) === 0,
    "One password login opens management without another challenge",
  );
  check(
    (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 200,
    "Same session authorized by server",
  );
  await page.screenshot({ path: `${out}/store-management-390.png` });
  const cookies = JSON.stringify(
    (await context.cookies()).filter((c) => c.name.includes("session")),
  );
  await page.getByRole("link", { name: "Back to Store", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile", exact: true });
  await expect(nav.getByRole("link", { name: "Store Management", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Store Management", exact: true }).click();
  await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  check(
    JSON.stringify((await context.cookies()).filter((c) => c.name.includes("session"))) === cookies,
    "Store and management navigation preserves the password session",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Administrator sign in" }).waitFor();
  check(
    (await page.request.get(`${ORIGIN}/api/admin/products`)).status() === 401,
    "Logout denies private data",
  );
  check(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "Mobile login has no horizontal clipping",
  );
  await context.close();
  console.log(
    `PASS: ${checks} branded single-login, OTP denial, management navigation and logout browser checks`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
