// PR #41 follow-up (owner-approved 2026-11-22): the customer's selections (colour, size, note)
// travel cart -> checkout -> API -> order_items.selections -> customer confirmation and admin order
// view; the same product may be ordered with different selections; identical selections combine;
// pricing, stock reservation, totals, idempotency, receipts and payment approval stay correct.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const GOWN = "dddddddd-0000-4000-8000-000000000001";
const GOWN_VARIANT = "dddddddd-0000-4000-8000-000000000002";
const { mf, db, variantId, zoneId } = await createTestApp({
  port: 8787,
  bindings: {
    CHECKOUT_ENABLED: "true",
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
const kano = { street: "11 Fixture Road", city: "Kano", state: "Kano" };
const customer = { name: "Selection Buyer", phone: "08012345678", email: "selection@example.com" };
const stock = async (id) =>
  db.prepare("SELECT stock FROM variants WHERE id=?").bind(id).first("stock");
const items = async (orderId) =>
  (
    await db
      .prepare(
        "SELECT variant_id,qty,price_kobo,selections FROM order_items WHERE order_id=? ORDER BY variant_id",
      )
      .bind(orderId)
      .all()
  ).results.map((r) => ({ ...r, selections: r.selections && JSON.parse(r.selections) }));
const browser = await chromium.launch();
try {
  // A gown listed in two colours, on sale: ₦26,000 regular, ₦20,000 sale, 10 in stock.
  await db.batch([
    db
      .prepare(
        "INSERT INTO products(id,slug,name,category,status) VALUES(?,'fx-colour-gown','Fixture Colour Gown','clothing','active')",
      )
      .bind(GOWN),
    db
      .prepare(
        "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,sale_price_kobo,stock) VALUES(?,?,'FX-CG-1','4-8','Red, Blue',2600000,2000000,10)",
      )
      .bind(GOWN_VARIANT, GOWN),
  ]);

  // 1. API: the same item with different selections, plus a repeated identical selection.
  const buyer = new Client(mf);
  await buyer.request("/me");
  const key = randomUUID();
  const lines = [
    { variantId: GOWN_VARIANT, qty: 1, note: "Size: 6 · Colour: Red" },
    { variantId: GOWN_VARIANT, qty: 2, note: "Size: 6 · Colour: Blue · Note: gift wrap" },
    { variantId: GOWN_VARIANT, qty: 1, note: "Size: 6 · Colour: Red" },
    { variantId, qty: 1 },
  ];
  const body = {
    lines,
    customer,
    fulfilmentMethod: "delivery",
    address: kano,
    idempotencyKey: key,
  };
  const created = await buyer.request("/orders", "POST", body);
  eq(created.status, 201, `Order created: ${JSON.stringify(created.body)}`);
  const order = created.body;
  eq(
    await items(order.id),
    [
      {
        variant_id: GOWN_VARIANT,
        qty: 4,
        price_kobo: 2000000,
        selections: [
          { qty: 2, note: "Size: 6 · Colour: Red" },
          { qty: 2, note: "Size: 6 · Colour: Blue · Note: gift wrap" },
        ],
      },
      { variant_id: variantId, qty: 1, price_kobo: 250000, selections: [{ qty: 1, note: null }] },
    ].sort((a, b) => a.variant_id.localeCompare(b.variant_id)),
    "One row per item; distinct selections kept, identical combined",
  );
  eq(await stock(GOWN_VARIANT), 6, "Stock reserved for all four gowns (10 - 4)");
  eq(await stock(variantId), 4, "Other item reserved once");
  // Sale price x 4 + romper ₦2,500 + Kano delivery ₦1,500 (subtotal below ₦250,000).
  eq(
    order.total_kobo,
    2000000 * 4 + 250000 + 150000,
    "Total uses sale price, all quantities and Kano fee",
  );
  eq(order.delivery_kobo, 150000, "Kano delivery below threshold");
  ok(
    order.items.some((i) => JSON.parse(i.selections).some((s) => s.note?.includes("gift wrap"))),
    "Confirmation response carries the selections",
  );

  // Retrying with the same key and the lines in another order replays the same order.
  const retry = await buyer.request("/orders", "POST", { ...body, lines: [...lines].reverse() });
  eq([retry.status, retry.body.id], [200, order.id], "Idempotent replay is order-independent");
  eq(await stock(GOWN_VARIANT), 6, "Replay reserves nothing more");
  // ...but the same key with different selections is refused.
  const changed = await buyer.request("/orders", "POST", {
    ...body,
    lines: [
      { variantId: GOWN_VARIANT, qty: 4, note: "Size: 6 · Colour: Red" },
      { variantId, qty: 1 },
    ],
  });
  eq(changed.status, 409, "Same key, different selections refused");

  // Customer and admin both read the saved selections.
  const mine = await buyer.request(`/orders/${order.id}`);
  ok(
    mine.body.items.some((i) => i.selections?.includes("Colour: Blue")),
    "Customer order view includes selections",
  );
  const stranger = new Client(mf);
  await stranger.request("/me");
  eq((await stranger.request(`/orders/${order.id}`)).status, 404, "Another visitor cannot read it");

  // 2. Limits and invalid input.
  const place = async (l) => {
    const c = new Client(mf);
    await c.request("/me");
    return c.request("/orders", "POST", { ...body, lines: l, idempotencyKey: randomUUID() });
  };
  const over = await place([
    { variantId: GOWN_VARIANT, qty: 60, note: "Colour: Red" },
    { variantId: GOWN_VARIANT, qty: 40, note: "Colour: Blue" },
  ]);
  eq(over.status, 400, "More than 99 of one item across selections refused");
  const short = await place([
    { variantId: GOWN_VARIANT, qty: 4, note: "Colour: Red" },
    { variantId: GOWN_VARIANT, qty: 3, note: "Colour: Blue" },
  ]);
  eq(short.status, 409, "Combined quantity above stock refused (6 left, 7 asked)");
  eq(await stock(GOWN_VARIANT), 6, "A refused order reserves nothing");
  eq((await place([{ variantId: randomUUID(), qty: 1 }])).status, 409, "Unknown item refused");
  eq((await place([{ variantId: "not-a-uuid", qty: 1 }])).status, 400, "Malformed item id refused");
  eq(
    (await place([{ variantId: GOWN_VARIANT, qty: 1, note: "x".repeat(201) }])).status,
    400,
    "Over-long selection text refused",
  );
  const exact = await place([
    { variantId: GOWN_VARIANT, qty: 3, note: "Colour: Red" },
    { variantId: GOWN_VARIANT, qty: 3, note: "Colour: Blue" },
  ]);
  eq(exact.status, 201, "Exactly the remaining stock across selections is accepted");
  eq(await stock(GOWN_VARIANT), 0, "Never negative");
  // Pickup and the ₦250,000 threshold use the combined quantity.
  await db.prepare("UPDATE variants SET stock=20 WHERE id=?").bind(GOWN_VARIANT).run();
  const big = await place([
    { variantId: GOWN_VARIANT, qty: 6, note: "Colour: Red" },
    { variantId: GOWN_VARIANT, qty: 7, note: "Colour: Blue" },
  ]);
  eq(
    [big.status, big.body.delivery_kobo, big.body.total_kobo],
    [201, 0, 26000000],
    "13 x ₦20,000 = ₦260,000: free Kano delivery",
  );
  const pickup = new Client(mf);
  await pickup.request("/me");
  const picked = await pickup.request("/orders", "POST", {
    lines: [
      { variantId: GOWN_VARIANT, qty: 1, note: "Colour: Red" },
      { variantId: GOWN_VARIANT, qty: 1, note: "Colour: Blue" },
    ],
    customer,
    fulfilmentMethod: "pickup",
    idempotencyKey: randomUUID(),
  });
  eq(
    [picked.status, picked.body.delivery_kobo, picked.body.total_kobo],
    [201, 0, 4000000],
    "Pickup free; both selections priced",
  );

  // 3. Receipt and payment approval on a multi-selection order.
  const png = await readFile("public/brand/afnan-collection-logo.png");
  const receipt = await buyer.request(`/orders/${order.id}/receipts`, "POST", new Uint8Array(png), {
    "Content-Type": "image/png",
  });
  eq(receipt.status, 201, "Receipt accepted for a multi-selection order");
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  const guest = new Client(mf);
  await guest.request("/admin-setup", "POST", { token, password: PASSWORD });
  const admin = new Client(mf);
  await admin.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD });
  const detail = await admin.request(`/admin/orders/${order.id}`);
  ok(
    detail.body.items.some((i) => i.selections?.includes("gift wrap")),
    "Admin order detail includes selections",
  );
  const partial = await admin.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
    amountKobo: 2000000 * 2 + 250000 + 150000,
    bankReference: "MP-SEL-1",
    creditConfirmed: true,
    receiptId: receipt.body.id,
  });
  eq(partial.status, 409, "Approval for only some of the gowns refused");
  const approved = await admin.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
    amountKobo: order.total_kobo,
    bankReference: "MP-SEL-2",
    creditConfirmed: true,
    receiptId: receipt.body.id,
  });
  eq([approved.status, approved.body.outcome], [200, "paid"], "Approval at the full total");

  // A row saved before this change (no selections) still reads correctly.
  await db
    .prepare("UPDATE order_items SET selections=NULL WHERE order_id=? AND variant_id=?")
    .bind(picked.body.id, GOWN_VARIANT)
    .run();
  eq(
    (await pickup.request(`/orders/${picked.body.id}`)).status,
    200,
    "Legacy line without selections still readable",
  );

  // 4. Browser at phone width: two colours of one gown -> cart (survives reload) -> checkout
  //    confirmation -> receipt upload -> admin order view.
  await db.prepare("UPDATE variants SET stock=10 WHERE id=?").bind(GOWN_VARIANT).run();
  await db.prepare("DELETE FROM rate_limits").run();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.120" },
  });
  await page.goto(`${ORIGIN}/product/fx-colour-gown`);
  for (const colour of ["Red", "Blue"]) {
    await page.getByRole("button", { name: colour, exact: true }).click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.locator("[data-added-to-cart]").waitFor();
  }
  await page.goto(`${ORIGIN}/cart`);
  await page.reload();
  // The cart is restored asynchronously after reload: wait for it before reading.
  await page.locator("#main").getByText("Colour: Blue").first().waitFor();
  const cartText = await page.locator("#main").innerText();
  ok(
    cartText.includes("Colour: Red") && cartText.includes("Colour: Blue"),
    "Both selections in the cart after reload",
  );
  await page.goto(`${ORIGIN}/checkout`);
  await page.getByLabel("Full name", { exact: true }).fill("Browser Selection Buyer");
  await page.getByLabel("Phone", { exact: true }).fill("08012345678");
  await page.getByLabel("Email", { exact: true }).fill("browser-selection@example.com");
  await page.getByLabel("Street address", { exact: true }).fill("Fixture street 10");
  await page.getByLabel("City", { exact: true }).fill("Kano");
  await page.getByLabel("State", { exact: true }).fill("Kano");
  await page.getByRole("button", { name: "Prepare order", exact: true }).click();
  await page.getByRole("heading", { name: "Order prepared" }).waitFor({ timeout: 10000 });
  const summary = await page.locator("aside").innerText();
  ok(
    summary.includes("2 × Fixture Colour Gown"),
    `Summary shows the combined quantity: ${summary}`,
  );
  ok(
    summary.includes("1 × Colour: Red") && summary.includes("1 × Colour: Blue"),
    `Summary shows each selection: ${summary}`,
  );
  ok(
    summary.includes("Amount payable to Afnan: ₦41,500"),
    "Two gowns at ₦20,000 + ₦1,500 Kano delivery",
  );
  const browserOrder = await db
    .prepare("SELECT id FROM orders WHERE email='browser-selection@example.com'")
    .first("id");
  eq((await items(browserOrder))[0].selections.length, 2, "Stored with both selections");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "I have paid — submit order receipt" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Paid order submitted for verification" })
    .waitFor();
  ok(true, "Receipt upload works from the confirmation page");
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "No overflow at 390 px",
  );

  await db.prepare("DELETE FROM rate_limits").run();
  const adminPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.121" },
  });
  await adminPage.goto(`${ORIGIN}/admin`);
  await adminPage.getByLabel("Email").fill(EMAIL);
  await adminPage.getByLabel("Password").fill(PASSWORD);
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  await openAdminSection(adminPage, "Orders");
  await adminPage
    .locator("li", { hasText: "Browser Selection Buyer" })
    .getByRole("button", { name: "View purchased items and delivery" })
    .click();
  const selections = adminPage.locator("[data-order-item] [data-selections]");
  await selections.first().waitFor();
  const adminText = await selections.first().innerText();
  ok(
    adminText.includes("Colour: Red") && adminText.includes("Colour: Blue"),
    `Admin sees both selections: ${adminText}`,
  );
  console.log(`PASS: ${checks} order selection, pricing, stock, receipt and admin checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
