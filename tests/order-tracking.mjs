// Order tracking, WhatsApp hand-off and administrator notifications (migration 0008).
// API: each real state change records exactly one inbox event in the same transaction (none when
// the change fails or repeats); emailed events get one outbox row; fulfilment staff see only
// fulfilment events; bank references cannot settle two orders; customer transfer references are
// stored and duplicates flagged. Browser (390 px): checkout -> persistent order page -> receipt
// with reference -> WhatsApp link -> /orders; admin inbox badge, list, open and mark read.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const STAFF = "packer@example.com";
const PASSWORD = "a long owner passphrase 2026";
const { mf, db, variantId } = await createTestApp({
  port: 8787,
  bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "disabled", ADMIN_AUTH_MODE: "password" },
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
const png = await readFile("public/brand/afnan-collection-logo.png");
const kano = { street: "11 Fixture Road", city: "Kano", state: "Kano" };
const events = async (orderId) =>
  (
    await db
      .prepare("SELECT kind,audience FROM admin_events WHERE order_id=? ORDER BY rowid")
      .bind(orderId)
      .all()
  ).results.map((e) => `${e.kind}/${e.audience}`);
const outbox = async (orderId) =>
  (
    await db
      .prepare(
        "SELECT e.kind,x.recipient,x.status,x.attempts FROM email_outbox x JOIN admin_events e ON e.id=x.event_id WHERE e.order_id=? ORDER BY x.rowid",
      )
      .bind(orderId)
      .all()
  ).results;
const placeOrder = async (client, email = "buyer@example.com", qty = 1) => {
  await client.request("/me");
  return client.request("/orders", "POST", {
    lines: [{ variantId, qty }],
    customer: { name: "Tracking Buyer", phone: "08012345678", email },
    fulfilmentMethod: "delivery",
    address: kano,
    idempotencyKey: randomUUID(),
  });
};
const signIn = async (email, ip) => {
  const c = new Client(mf);
  c.ip = ip;
  const r = await c.request("/auth/sign-in/email", "POST", { email, password: PASSWORD });
  assert.equal(r.status, 200, `sign in ${email}`);
  return c;
};
const browser = await chromium.launch();
try {
  await db.prepare("UPDATE variants SET stock=50 WHERE id=?").bind(variantId).run();
  // Staff: one admin and one fulfilment member.
  const setup = new Client(mf);
  for (const email of [EMAIL, STAFF]) {
    const { statements, token } = provisionPasswordAdmin({ email });
    for (const s of statements) await db.prepare(s).run();
    await setup.request("/admin-setup", "POST", { token, password: PASSWORD });
  }
  await db
    .prepare("UPDATE staff SET role='fulfilment' WHERE user_id=(SELECT id FROM user WHERE email=?)")
    .bind(STAFF)
    .run();
  const admin = await signIn(EMAIL, "203.0.113.10");
  const packer = await signIn(STAFF, "203.0.113.11");
  eq((await new Client(mf).request("/admin/events")).status, 401, "Inbox needs a session");

  // 1. New order: one event, one staff email (test mode delivers at once); retry adds nothing.
  const buyer = new Client(mf);
  await buyer.request("/me");
  const key = randomUUID();
  const body = {
    lines: [{ variantId, qty: 1 }],
    customer: { name: "Tracking Buyer", phone: "08012345678", email: "buyer@example.com" },
    fulfilmentMethod: "delivery",
    address: kano,
    idempotencyKey: key,
  };
  const created = await buyer.request("/orders", "POST", body);
  eq(created.status, 201);
  const order = created.body;
  eq(await events(order.id), ["order.created/admin"], "Order created event");
  eq(
    await outbox(order.id),
    [
      {
        kind: "order.created",
        recipient: "sales@afnancollectionkn.com",
        status: "test",
        attempts: 1,
      },
    ],
    "Staff email delivered once (test mode)",
  );
  eq((await buyer.request("/orders", "POST", body)).status, 200, "Idempotent retry");
  eq((await events(order.id)).length, 1, "Retry adds no event");
  // A failed order (not enough stock) records no event.
  const before = await db.prepare("SELECT COUNT(*) n FROM admin_events").first("n");
  eq((await placeOrder(new Client(mf), "big@example.com", 99)).status, 409, "Stock refusal");
  eq(
    await db.prepare("SELECT COUNT(*) n FROM admin_events").first("n"),
    before,
    "No event for a failed order",
  );

  // 2. Customer tracking and ownership.
  const mine = await buyer.request(`/orders/${order.id}`);
  eq([mine.status, mine.body.paymentStatus], [200, "Awaiting Transfer"]);
  ok(
    (await buyer.request("/orders")).body.some((o) => o.id === order.id),
    "Listed on this device",
  );
  const stranger = new Client(mf);
  await stranger.request("/me");
  eq((await stranger.request(`/orders/${order.id}`)).status, 404, "Another device cannot open it");

  // 3. Receipt with a customer transfer reference.
  const upload = (client, id, ref, bytes = png) =>
    client.request(`/orders/${id}/receipts`, "POST", new Uint8Array(bytes), {
      "Content-Type": "image/png",
      ...(ref ? { "X-Transfer-Reference": ref } : {}),
    });
  eq((await upload(buyer, order.id, "<script>")).status, 400, "Malformed reference refused");
  const receipt = await upload(buyer, order.id, "MNPT-2026-ABC123");
  eq(receipt.status, 201, "Receipt with reference accepted");
  eq(
    await db
      .prepare("SELECT transfer_reference FROM payment_receipts WHERE id=?")
      .bind(receipt.body.id)
      .first("transfer_reference"),
    "MNPT-2026-ABC123",
    "Reference stored",
  );
  eq(await events(order.id), ["order.created/admin", "receipt.uploaded/admin"]);
  eq(
    (await outbox(order.id)).map((x) => [x.kind, x.status]),
    [
      ["order.created", "test"],
      ["receipt.uploaded", "test"],
    ],
  );
  eq(
    (await upload(buyer, order.id, "MNPT-2026-ABC123")).body.duplicate,
    true,
    "Same file is a duplicate",
  );
  eq((await events(order.id)).length, 2, "Duplicate upload adds no event");

  // A second order reusing the same customer reference is flagged in payment review.
  const other = new Client(mf);
  const second = (await placeOrder(other, "second@example.com")).body;
  const altered = Buffer.from(png);
  altered[altered.length - 1] ^= 1; // different bytes, so not a duplicate file
  eq((await upload(other, second.id, "mnpt-2026-abc123", altered)).status, 201);
  const review = (await admin.request("/admin/payment-review")).body;
  const flagged = review.find((o) => o.id === second.id).receipts[0];
  ok(
    flagged.duplicate_orders?.includes(order.reference),
    `Duplicate reference flagged: ${flagged.duplicate_orders}`,
  );

  // 4. Inbox visibility, unread counts and read state.
  const feed = (await admin.request("/admin/events")).body;
  ok(
    feed.unread >= 4 && feed.events.some((e) => e.kind === "receipt.uploaded"),
    "Admin sees payment events",
  );
  ok(
    !JSON.stringify(feed).includes("08012345678") && !JSON.stringify(feed).includes("Fixture Road"),
    "Inbox carries no contact details",
  );
  const staffFeed = (await packer.request("/admin/events")).body;
  eq(
    [staffFeed.unread, staffFeed.events.length],
    [0, 0],
    "Fulfilment staff see no payment/new-order events",
  );
  eq(
    (await packer.request("/admin/events/read", "POST", {})).body.marked,
    0,
    "Fulfilment cannot mark admin events",
  );
  const first = feed.events.find((e) => e.kind === "order.created");
  eq((await admin.request("/admin/events/read", "POST", { ids: [first.id] })).body.marked, 1);
  eq(
    (await admin.request("/admin/events")).body.unread,
    feed.unread - 1,
    "Unread count drops by one",
  );

  // 5. Rejection, then approval; bank reference replay is refused.
  eq(
    (
      await admin.request(`/admin/receipts/${receipt.body.id}/reject`, "POST", {
        reason: "Amount not visible",
      })
    ).status,
    200,
  );
  eq(
    (await admin.request(`/admin/receipts/${receipt.body.id}/reject`, "POST", { reason: "Again" }))
      .status,
    409,
  );
  eq(
    (await events(order.id)).filter((e) => e.startsWith("receipt.rejected")).length,
    1,
    "One rejection event",
  );
  eq(
    (await buyer.request(`/orders/${order.id}`)).body.paymentStatus,
    "Rejected",
    "Customer sees rejection",
  );
  const approve = (id, total, ref) =>
    admin.request(`/admin/orders/${id}/bank-transfer-approval`, "POST", {
      amountKobo: total,
      bankReference: ref,
      creditConfirmed: true,
    });
  eq((await approve(order.id, order.total_kobo, "MP-REF-0001")).body.outcome, "paid");
  const replay = await approve(second.id, second.total_kobo, " mp-ref-0001 ");
  eq(replay.status, 409, "Bank reference reuse refused");
  ok(
    replay.body.error.includes(order.reference),
    `Reuse names the first order: ${replay.body.error}`,
  );
  await assert.rejects(
    db
      .prepare(
        "INSERT INTO bank_transfer_approvals(order_id,decision_id,amount_kobo,bank_reference,outcome,approved_by,approved_at) VALUES(?,?,?,?,'paid','x',1)",
      )
      .bind(second.id, randomUUID(), second.total_kobo, "MP-REF-0001")
      .run(),
    "Unique index also blocks a concurrent replay",
  );
  checks++;
  ok((await events(order.id)).includes("payment.verified/staff"), "Payment verified event (staff)");
  ok(
    (await packer.request("/admin/events")).body.events.some((e) => e.kind === "payment.verified"),
    "Fulfilment sees paid orders",
  );

  // 6. Fulfilment steps: one event per real transition, none for a refused one.
  for (const status of ["processing", "shipped", "delivered"])
    eq(
      (await packer.request(`/admin/orders/${order.id}`, "PATCH", { status })).status,
      200,
      status,
    );
  eq(
    (await packer.request(`/admin/orders/${order.id}`, "PATCH", { status: "shipped" })).status,
    409,
    "Invalid transition",
  );
  eq(
    (await events(order.id)).filter((e) => /order\.(processing|shipped|delivered)/.test(e)),
    ["order.processing/staff", "order.shipped/staff", "order.delivered/staff"],
    "Fulfilment events",
  );
  eq((await buyer.request(`/orders/${order.id}`)).body.status, "delivered");

  // 7. Customer cancellation (once), expiry and late payment.
  const third = new Client(mf);
  const cancelMe = (await placeOrder(third, "third@example.com")).body;
  await third.request(`/orders/${cancelMe.id}/cancel`, "POST", {});
  await third.request(`/orders/${cancelMe.id}/cancel`, "POST", {});
  eq(
    (await events(cancelMe.id)).filter((e) => e.startsWith("order.cancelled")).length,
    1,
    "One cancellation event",
  );
  const fourth = new Client(mf);
  const late = (await placeOrder(fourth, "fourth@example.com")).body;
  await db.prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?").bind(late.id).run();
  await fourth.request("/orders");
  await fourth.request("/orders");
  eq(
    (await events(late.id)).filter((e) => e.startsWith("order.expired")).length,
    1,
    "One expiry event",
  );
  eq((await approve(late.id, late.total_kobo, "MP-LATE-1")).body.outcome, "late_review");
  ok((await events(late.id)).includes("payment.late_review/admin"), "Late payment event");
  ok(
    (await outbox(late.id)).some((x) => x.kind === "payment.late_review"),
    "Late payment emailed",
  );

  // 8. Outbox retry: a due failed row is retried when the inbox is polled, without duplicating.
  await db
    .prepare("UPDATE email_outbox SET status='failed',next_attempt_at=0 WHERE event_id=?")
    .bind(`order.created:${late.id}`)
    .run();
  await admin.request("/admin/events");
  const retried = await db
    .prepare("SELECT status,attempts FROM email_outbox WHERE event_id=?")
    .bind(`order.created:${late.id}`)
    .first();
  eq([retried.status, retried.attempts], ["test", 2], "Failed email retried once");
  eq(
    await db
      .prepare("SELECT COUNT(*) n FROM email_outbox WHERE event_id=?")
      .bind(`order.created:${late.id}`)
      .first("n"),
    1,
    "Still one outbox row",
  );

  // 9. Browser: checkout -> persistent order page -> receipt + reference -> WhatsApp -> /orders.
  await db.prepare("DELETE FROM rate_limits").run();
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.140" },
  });
  const page = await customerContext.newPage();
  await page.goto(`${ORIGIN}/shop`);
  await page
    .getByRole("link", { name: /Test fixture romper/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.locator("[data-added-to-cart]").waitFor();
  await page.goto(`${ORIGIN}/checkout`);
  await page.getByLabel("Full name", { exact: true }).fill("Browser Tracking Buyer");
  await page.getByLabel("Phone", { exact: true }).fill("08012345678");
  await page.getByLabel("Email", { exact: true }).fill("browser-tracking@example.com");
  await page.getByLabel("Street address", { exact: true }).fill("Fixture street 10");
  await page.getByLabel("City", { exact: true }).fill("Kano");
  await page.getByLabel("State", { exact: true }).fill("Kano");
  await page.getByRole("button", { name: "Prepare order", exact: true }).click();
  await page.getByRole("heading", { name: "Order prepared" }).waitFor({ timeout: 10000 });
  const wa = await page.locator("[data-whatsapp-receipt]").first().getAttribute("href");
  const text = decodeURIComponent(new URL(wa).searchParams.get("text"));
  ok(wa.startsWith("https://wa.me/2347035963225?text="), "WhatsApp opens the business number");
  ok(/order AC-\d{8}-\d{4} for ₦4,000\./.test(text), `Message has reference and amount: ${text}`);
  ok(
    !/Fixture street|08012345678|afnan_guest|\/api\//.test(text),
    "No address, phone, token or storage link",
  );
  await page.getByRole("link", { name: "Track this order" }).click();
  await page.waitForURL(/\/order\//);
  await page.reload();
  const status = page.locator("[data-order-status]");
  await status.waitFor();
  eq(await status.innerText(), "Awaiting Transfer", "Order page survives reload");
  const axe = await new AxeBuilder({ page }).include("#main").analyze();
  const serious = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  eq(
    serious.map((v) => v.id),
    [],
    "Order page has no serious accessibility issues",
  );
  ok(
    (await page.locator("#main").innerText()).includes("7035963225"),
    "Bank details on order page",
  );
  await page.getByLabel("Transfer reference (optional)").fill("MP-BROWSER-77");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Submit receipt" }).click();
  await page.locator("[data-order-status]", { hasText: "Receipt Submitted" }).waitFor();
  ok(true, "Status updates to Receipt Submitted after upload");
  ok(
    !(await page.locator("#main").innerText()).includes("Awaiting transfer."),
    "No contradictory 'Awaiting transfer' line once a receipt is submitted",
  );
  if (process.env.TRACKING_SCREENSHOTS)
    await page.screenshot({
      path: `${process.env.TRACKING_SCREENSHOTS}/order-page-390.png`,
      fullPage: true,
    });
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "Order page fits 390 px",
  );
  const url = page.url();
  await page.goto(`${ORIGIN}/orders`);
  await page.getByText("Receipt Submitted").first().waitFor();
  ok(true, "Order listed on /orders with its status");
  const otherDevice = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await otherDevice.goto(url);
  await otherDevice.getByText("We could not find this order on this device").waitFor();
  ok(true, "Another browser cannot open the order page");
  await otherDevice.close();

  // 10. Admin inbox in the browser.
  await db.prepare("DELETE FROM rate_limits").run();
  const adminPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.141" },
  });
  await adminPage.goto(`${ORIGIN}/admin`);
  await adminPage.getByLabel("Email").fill(EMAIL);
  await adminPage.getByLabel("Password").fill(PASSWORD);
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  const badge = adminPage.locator("[data-unread-count]");
  await badge.waitFor();
  ok(parseInt(await badge.innerText(), 10) > 0, "Unread badge shown");
  await adminPage.locator("[data-notification-inbox] > button").click();
  const receiptEvent = adminPage.locator('[data-event="receipt.uploaded"]').first();
  await receiptEvent.waitFor();
  ok((await receiptEvent.innerText()).includes("verification required"), "Receipt event described");
  if (process.env.TRACKING_SCREENSHOTS)
    await adminPage.screenshot({ path: `${process.env.TRACKING_SCREENSHOTS}/admin-inbox-390.png` });
  ok(
    !(await adminPage.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "Inbox fits 390 px",
  );
  await receiptEvent.locator("button").click();
  await adminPage.getByRole("heading", { name: "Bank-transfer payments" }).waitFor();
  ok(true, "Opening a receipt event goes to payment review");
  // Payment review loads asynchronously after the section opens.
  await adminPage
    .locator("[data-transfer-reference]", { hasText: "MP-BROWSER-77" })
    .first()
    .waitFor();
  ok(true, "Customer reference shown to admin");
  await adminPage.locator("[data-notification-inbox] > button").click();
  await adminPage.getByRole("button", { name: "Mark all read" }).click();
  await badge.waitFor({ state: "detached" });
  ok(true, "Mark all read clears the badge");
  console.log(`PASS: ${checks} order tracking, WhatsApp, inbox, outbox and replay checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
