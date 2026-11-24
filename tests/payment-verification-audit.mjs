// Payment verification accountability (issue #55) at 390 and 1280 px: the approval form shows who
// is verifying, read-only from the session; one staff member approves two different credits with
// different bank references; a reused reference, a wrong amount, a missing reference and the
// staff member's own name are refused inline, with the inputs kept and the order left unpaid; the
// order's payment history shows verifier, account, amount, reference and Nigeria time; earlier
// approval records are unchanged by later failures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN, openAdminSection } from "./harness.mjs";
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
const place = async () => {
  const c = new Client(mf);
  await c.request("/me");
  const r = await c.request("/orders", "POST", {
    lines: [{ variantId, qty: 1 }],
    customer: { name: "Audit Buyer", phone: "08000000000", email: "audit@example.com" },
    idempotencyKey: randomUUID(),
    fulfilmentMethod: "pickup",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};
const statusOf = (id) =>
  db.prepare("SELECT status FROM orders WHERE id=?").bind(id).first("status");
const browser = await chromium.launch();
try {
  await db
    .prepare("UPDATE variants SET price_kobo=250000, sale_price_kobo=NULL, stock=100 WHERE id=?")
    .bind(variantId)
    .run();
  for (const width of [390, 1280]) {
    await db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM session")]);
    const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
    for (const s of statements) await db.prepare(s).run();
    const staffName = await db
      .prepare("SELECT name FROM user WHERE email=?")
      .bind(EMAIL)
      .first("name");
    const [first, second, third] = [await place(), await place(), await place()];
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 140 : 141}` },
    });
    await page.goto(`${ORIGIN}/admin?setup=${token}`);
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    await openAdminSection(page, "Payments");
    const card = (o) =>
      page.getByRole("listitem").filter({ hasText: `Order ${o.reference ?? o.id}` });
    const approve = async (o, amount, ref) => {
      const c = card(o);
      await c.getByLabel("Amount credited (₦)").fill(amount);
      await c.getByLabel("Bank transaction reference").fill(ref);
      const box = c.getByRole("checkbox");
      if (!(await box.isChecked())) await box.check();
      await c.getByRole("button", { name: "Approve payment" }).click();
    };
    const tag = `${width}`;
    // Read-only verifier, from the session.
    const verifier = await card(first).locator("[data-verifier]").innerText();
    ok(
      verifier.includes(staffName) && verifier.includes(EMAIL),
      `verifier shown at ${width}: ${verifier}`,
    );
    eq(
      await card(first)
        .locator("[data-verifier]")
        .evaluate((e) => e.tagName),
      "SPAN",
      "verifier is not an input",
    );

    // The same staff member approves two different credits.
    await approve(first, "2500", `MP-${tag}-0001`);
    await page.getByRole("status").filter({ hasText: "marked paid" }).waitFor();
    await approve(second, "2500", `MP-${tag}-0002`);
    await page
      .getByRole("status")
      .filter({ hasText: `Order ${second.reference ?? second.id} marked paid` })
      .waitFor();
    eq(
      [await statusOf(first.id), await statusOf(second.id)],
      ["paid", "paid"],
      "both approved by one staff member",
    );
    const before = await db
      .prepare(
        "SELECT order_id,amount_kobo,bank_reference,outcome,approved_by,approved_at FROM bank_transfer_approvals ORDER BY order_id",
      )
      .all();

    // Refusals, inline, inputs kept, order still unpaid.
    const refuse = async (amount, ref, pattern, what) => {
      await approve(third, amount, ref);
      const err = card(third).locator("[data-approval-error]");
      await err.waitFor();
      ok(pattern.test(await err.innerText()), `${what}: "${await err.innerText()}"`);
      eq(
        await card(third).getByLabel("Bank transaction reference").inputValue(),
        ref,
        `${what}: reference kept`,
      );
      eq(await statusOf(third.id), "pending", `${what}: order left unpaid`);
    };
    await refuse(
      "2500",
      ` mp-${tag}-0001 `,
      /already used for order/,
      "duplicate reference (case/space-insensitive)",
    );
    await refuse("2400", `MP-${tag}-0003`, /exact amount credited/, "wrong amount");
    await refuse("2500", staffName, /not a staff name/, "staff name as reference");
    await refuse("2500", EMAIL, /not a staff name/, "staff email as reference");
    // Missing reference: the browser's own required check stops it; nothing is sent.
    await card(third).getByLabel("Bank transaction reference").fill("");
    let posts = 0;
    page.on("request", (r) => r.url().includes("/bank-transfer-approval") && posts++);
    await card(third).getByRole("button", { name: "Approve payment" }).click();
    eq(posts, 0, "missing reference is not submitted");
    eq(await statusOf(third.id), "pending", "missing reference: order left unpaid");
    eq(
      (
        await db
          .prepare(
            "SELECT order_id,amount_kobo,bank_reference,outcome,approved_by,approved_at FROM bank_transfer_approvals ORDER BY order_id",
          )
          .all()
      ).results,
      before.results,
      "earlier approval records unchanged by the refusals",
    );
    ok(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
      `no horizontal overflow at ${width}`,
    );

    // Payment history on the order shows the verifier and the credit.
    await openAdminSection(page, "Orders");
    const orderCard = page
      .getByRole("listitem")
      .filter({ hasText: first.reference ?? first.id })
      .first();
    await orderCard.getByRole("button", { name: "View purchased items and delivery" }).click();
    const history = orderCard.locator("[data-payment-verification]");
    await history.waitFor();
    eq(await history.locator("[data-verified-by]").innerText(), staffName, "verified by");
    eq(await history.locator("[data-staff-account]").innerText(), EMAIL, "staff account");
    eq(
      await history.locator("[data-bank-reference]").innerText(),
      `MP-${tag}-0001`,
      "bank reference",
    );
    ok((await history.innerText()).includes("₦2,500"), "amount verified");
    const approvedAt = await db
      .prepare("SELECT approved_at FROM bank_transfer_approvals WHERE order_id=?")
      .bind(first.id)
      .first("approved_at");
    const nigeria = new Date(approvedAt * 1000).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short",
    });
    eq(
      await history.locator("[data-verified-at]").innerText(),
      `${nigeria} (Nigeria)`,
      "verified at, Nigeria time",
    );
    await page.close();
  }
  console.log(`PASS: ${checks} payment verification accountability checks at 390/1280 px`);
} finally {
  await browser.close();
  await mf.dispose();
}
