// Approved delivery policy as a deployed store applies it (LEGACY_ZONE_ORDERS unset, as in the
// production and acceptance deploy configs): Kano ₦1,500 below ₦250,000 and free from ₦250,000,
// store pickup free, other states paid directly to the transport company (no fee to Afnan), and
// the pre-#41 per-zone path refused. Also checks the amounts staff must approve and the checkout
// quote a customer sees.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const { mf, db, variantId, zoneId } = await createTestApp({
  port: 8787,
  bindings: {
    CHECKOUT_ENABLED: "true",
    PAYMENT_MODE: "disabled",
    ADMIN_AUTH_MODE: "password",
    LEGACY_ZONE_ORDERS: "", // as deployed
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
const customer = { name: "Policy Buyer", phone: "08012345678", email: "policy@example.com" };
const kano = { street: "11 Fixture Road", city: "Kano", state: "Kano" };
const place = async (subtotalKobo, extra) => {
  await db
    .prepare("UPDATE variants SET price_kobo=?, sale_price_kobo=NULL, stock=100 WHERE id=?")
    .bind(subtotalKobo, variantId)
    .run();
  const c = new Client(mf);
  await c.request("/me");
  return c.request("/orders", "POST", {
    lines: [{ variantId, qty: 1 }],
    customer,
    idempotencyKey: randomUUID(),
    ...extra,
  });
};
const browser = await chromium.launch();
try {
  // 1. Server-side charges at the boundaries.
  const cases = [
    ["Kano, ₦249,999.99", 24_999_999, { fulfilmentMethod: "delivery", address: kano }, 150_000, 0],
    ["Kano, exactly ₦250,000", 25_000_000, { fulfilmentMethod: "delivery", address: kano }, 0, 0],
    ["Kano, above ₦250,000", 30_000_000, { fulfilmentMethod: "delivery", address: kano }, 0, 0],
    [
      "'Kano State' spelling",
      1_000_000,
      { fulfilmentMethod: "delivery", address: { ...kano, state: "Kano State" } },
      150_000,
      0,
    ],
    ["Store pickup, small order", 1_000_000, { fulfilmentMethod: "pickup" }, 0, 0],
    ["Store pickup, large order", 30_000_000, { fulfilmentMethod: "pickup" }, 0, 0],
    [
      "Lagos (interstate)",
      1_000_000,
      { fulfilmentMethod: "delivery", address: { ...kano, city: "Ikeja", state: "Lagos" } },
      0,
      1,
    ],
    [
      "Abuja FCT, large (interstate)",
      30_000_000,
      { fulfilmentMethod: "delivery", address: { ...kano, city: "Abuja", state: "FCT" } },
      0,
      1,
    ],
  ];
  const orders = {};
  for (const [label, subtotal, extra, fee, carrier] of cases) {
    const r = await place(subtotal, extra);
    eq(r.status, 201, `${label}: ${JSON.stringify(r.body.error ?? "")}`);
    eq(
      [r.body.delivery_kobo, r.body.total_kobo, r.body.carrier_paid_direct],
      [fee, subtotal + fee, carrier],
      `${label}: fee ₦${fee / 100}, total = goods + fee, carrier-direct ${carrier}`,
    );
    orders[label] = r.body;
  }
  // 2. The old per-zone path is refused (its zone fee had no free threshold).
  const legacy = await place(30_000_000, { zoneId, address: kano });
  eq(
    [legacy.status, legacy.body.error],
    [400, "Choose delivery or store pickup"],
    "Per-zone delivery path refused",
  );
  eq(
    (await place(1_000_000, { fulfilmentMethod: "delivery" })).status,
    400,
    "Delivery without an address refused",
  );
  eq(
    (await place(1_000_000, { fulfilmentMethod: "pickup", address: kano })).status,
    400,
    "Pickup with an address refused",
  );

  // 3. Staff approval must match the stored total: goods + Afnan delivery only.
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  await new Client(mf).request("/admin-setup", "POST", { token, password: PASSWORD });
  const admin = new Client(mf);
  await admin.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD });
  const approve = (o, amount, ref) =>
    admin.request(`/admin/orders/${o.id}/bank-transfer-approval`, "POST", {
      amountKobo: amount,
      bankReference: ref,
      creditConfirmed: true,
    });
  const small = orders["Kano, ₦249,999.99"];
  eq(
    (await approve(small, 24_999_999, "POLICY-1")).status,
    409,
    "Approval without the ₦1,500 delivery refused",
  );
  eq(
    (await approve(small, small.total_kobo, "POLICY-2")).body.outcome,
    "paid",
    "Approval at goods + ₦1,500",
  );
  const lagos = orders["Lagos (interstate)"];
  eq(
    (await approve(lagos, 1_000_000, "POLICY-3")).body.outcome,
    "paid",
    "Interstate approved at goods only (carrier paid directly)",
  );

  // 4. The checkout quote a customer sees (phone width).
  await db
    .prepare("UPDATE variants SET price_kobo=250000, stock=100 WHERE id=?")
    .bind(variantId)
    .run();
  await db.prepare("DELETE FROM rate_limits").run();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/shop`);
  await page
    .getByRole("link", { name: /Test fixture romper/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.locator("[data-added-to-cart]").waitFor();
  await page.goto(`${ORIGIN}/checkout`);
  const summary = page.locator("aside");
  await summary.filter({ hasText: "Test fixture romper" }).waitFor();
  await page.getByLabel("State", { exact: true }).fill("Kano");
  await summary.filter({ hasText: "Delivery: ₦1,500" }).waitFor();
  ok((await summary.innerText()).includes("₦4,000"), "Kano quote: ₦2,500 + ₦1,500");
  await page.getByLabel("State", { exact: true }).fill("Lagos");
  await summary.filter({ hasText: "Paid directly to transport company" }).waitFor();
  ok(
    (await summary.innerText()).includes("₦2,500"),
    "Interstate quote: goods only, carrier paid directly",
  );
  await page.getByText("Store pickup — FREE").click();
  await summary.filter({ hasText: "Store pickup" }).waitFor();
  ok((await summary.innerText()).includes("₦2,500"), "Pickup quote: goods only");
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "Checkout fits 390 px",
  );
  console.log(
    `PASS: ${checks} delivery policy checks as deployed (charges, legacy path refused, approval amounts, quote)`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
