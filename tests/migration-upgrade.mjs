// Acceptance release preparation (2026-11-22): migrations 0007 and 0008 applied to a database that
// already holds data written by the 0006-era release (orders in every state, a reservation,
// evidence, a bank-transfer approval, a legacy staff notification), exactly as the acceptance D1 will
// be upgraded. Proves the upgrade preserves that data, and that the full checkout lifecycle works on
// the upgraded database: legacy and new orders, stock reservation and restoration, receipts with a
// transfer reference, payment review, bank-reference replay against a pre-existing approval,
// cancellation, the 90-day guest cookie, cross-device isolation, admin events and email retry.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { applyMigrations, createTestApp, Client, MIGRATIONS } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const { mf, db, variantId, zoneId } = await createTestApp({
  port: 8787,
  migrations: MIGRATIONS.slice(0, 6), // the schema acceptance has today
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
const sha = (v) => createHash("sha256").update(v).digest("hex");
const all = async (sql, ...p) =>
  (
    await db
      .prepare(sql)
      .bind(...p)
      .all()
  ).results;
const one = async (sql, ...p) =>
  db
    .prepare(sql)
    .bind(...p)
    .first();
const stock = async () => (await one("SELECT stock FROM variants WHERE id=?", variantId)).stock;
try {
  // 1. Data written by the 0006-era release.
  const token = "a".repeat(64); // a returning guest's cookie value
  const owner = `guest:${sha(token)}`;
  await db.prepare("UPDATE variants SET stock=20 WHERE id=?").bind(variantId).run();
  const legacyOrder = (id, status, qty, extra = {}) => [
    db
      .prepare(
        "INSERT INTO orders(id,owner,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,total_kobo,status,payment_method,reference,expires_at) VALUES(?,?,?,?,?,?,?,?,50000,0,'pending','bank_transfer',?,?)",
      )
      .bind(
        id,
        extra.owner ?? owner,
        randomUUID(),
        "legacy-hash",
        `${id}@example.com`,
        JSON.stringify({ name: "Legacy Buyer", phone: "08000000000", email: `${id}@example.com` }),
        JSON.stringify({ street: "1 Legacy Road", city: "Kano", state: "Kano" }),
        zoneId,
        `AC-20261101-${id.slice(-4)}`,
        Math.floor(Date.now() / 1000) + 86400,
      ),
    // reserve_stock trigger takes the units, as the old release did.
    db
      .prepare(
        "INSERT INTO order_items(order_id,variant_id,name,sku,price_kobo,qty) VALUES(?,?,'Test fixture romper','FIXTURE-001',250000,?)",
      )
      .bind(id, variantId, qty),
    db
      .prepare(
        "UPDATE orders SET total_kobo=delivery_kobo+(SELECT SUM(price_kobo*qty) FROM order_items WHERE order_id=?) WHERE id=?",
      )
      .bind(id, id),
    ...(status === "pending"
      ? []
      : [
          db
            .prepare("UPDATE orders SET status=? WHERE id=?")
            .bind(status === "paid" ? "pending" : status, id),
        ]),
  ];
  await db.batch([
    ...legacyOrder("legacy-pending-0001", "pending", 2),
    ...legacyOrder("legacy-paid-0002", "paid", 1, { owner: "guest:someone-else" }),
    ...legacyOrder("legacy-expired-0003", "expired", 3),
  ]);
  // The paid order was approved by staff under the old release (bank reference MP-LEGACY-1).
  await db.batch([
    db
      .prepare(
        "INSERT INTO bank_transfer_approvals(order_id,decision_id,amount_kobo,bank_reference,outcome,approved_by,approved_at) SELECT id,?,total_kobo,'MP-LEGACY-1','paid','legacy-admin',unixepoch() FROM orders WHERE id='legacy-paid-0002'",
      )
      .bind(randomUUID()),
    db.prepare("UPDATE orders SET status='paid' WHERE id='legacy-paid-0002'"),
    db.prepare(
      `INSERT INTO payment_receipts(id,order_id,object_key,content_type,bytes,sha256,submitted_at) VALUES('legacy-receipt','legacy-paid-0002','receipts/legacy/r.png','image/png',100,'${"b".repeat(64)}',unixepoch())`,
    ),
    db.prepare(
      "INSERT INTO notifications(id,kind,order_id,recipient,status,created_at,updated_at) VALUES('legacy-notice','payment_review','legacy-paid-0002','sales@afnancollectionkn.com','sent',1,1)",
    ),
  ]);
  const before = {
    stock: await stock(),
    orders: await all(
      "SELECT id,owner,status,zone_id,delivery_kobo,total_kobo,payment_method,reference,expires_at FROM orders ORDER BY id",
    ),
    items: await all(
      "SELECT order_id,variant_id,price_kobo,qty FROM order_items ORDER BY order_id",
    ),
    approvals: await all(
      "SELECT order_id,bank_reference,outcome,amount_kobo FROM bank_transfer_approvals",
    ),
    receipts: await all("SELECT id,order_id,status,sha256 FROM payment_receipts"),
    notifications: await all("SELECT id,status FROM notifications"),
    movements: (await one("SELECT COUNT(*) n FROM inventory_movements")).n,
  };
  // The expired order released its 3 units through restore_stock, as expiry does.
  eq(before.stock, 20 - 2 - 1, "Legacy reservations: 2 pending + 1 paid held; expired released");

  // 2. Upgrade: 0007 then 0008, as the acceptance workflow applies them.
  await applyMigrations(db, MIGRATIONS.slice(6));
  eq(await stock(), before.stock, "Stock unchanged by the upgrade");
  eq(
    await all(
      "SELECT id,owner,status,zone_id,delivery_kobo,total_kobo,payment_method,reference,expires_at FROM orders ORDER BY id",
    ),
    before.orders,
    "Legacy orders unchanged",
  );
  eq(
    await all("SELECT order_id,variant_id,price_kobo,qty FROM order_items ORDER BY order_id"),
    before.items,
    "Legacy order lines unchanged",
  );
  eq(
    await all("SELECT order_id,bank_reference,outcome,amount_kobo FROM bank_transfer_approvals"),
    before.approvals,
    "Legacy approval unchanged",
  );
  eq(
    await all("SELECT id,order_id,status,sha256 FROM payment_receipts"),
    before.receipts,
    "Legacy receipt unchanged",
  );
  eq(
    await all("SELECT id,status FROM notifications"),
    before.notifications,
    "Legacy notification kept",
  );
  eq(
    (await one("SELECT COUNT(*) n FROM inventory_movements")).n,
    before.movements,
    "Inventory history unchanged",
  );
  eq(
    await all("SELECT DISTINCT fulfilment_method,carrier_paid_direct FROM orders"),
    [{ fulfilment_method: "delivery", carrier_paid_direct: 0 }],
    "Legacy orders default to delivery",
  );
  eq(
    (await one("SELECT COUNT(*) n FROM order_items WHERE selections IS NOT NULL")).n,
    0,
    "Legacy lines have no selections",
  );
  eq(
    (await one("SELECT COUNT(*) n FROM payment_receipts WHERE transfer_reference IS NOT NULL")).n,
    0,
    "No reference backfill",
  );
  eq(
    (await one("SELECT (SELECT COUNT(*) FROM admin_events)+(SELECT COUNT(*) FROM email_outbox) n"))
      .n,
    0,
    "Inbox and outbox start empty",
  );
  eq(
    (await one("SELECT COUNT(*) n FROM zones WHERE active=0 AND fee_kobo=0")).n,
    3,
    "Internal zones added inactive",
  );
  eq(
    (await one("SELECT quick_check FROM pragma_quick_check")).quick_check,
    "ok",
    "Integrity ok after upgrade",
  );
  eq(
    (await one("SELECT COUNT(*) n FROM pragma_foreign_key_check")).n,
    0,
    "No foreign-key violations",
  );

  // 3. The returning guest reopens a legacy order; another device cannot.
  const guest = new Client(mf);
  guest.cookies.set("afnan_guest", token);
  const legacy = await guest.request("/orders/legacy-pending-0001");
  eq(
    [legacy.status, legacy.body.paymentStatus, legacy.body.fulfilment_method],
    [200, "Awaiting Transfer", "delivery"],
    "Legacy order opens after upgrade",
  );
  ok(
    (await guest.request("/orders")).body.some((o) => o.id === "legacy-expired-0003"),
    "Legacy orders listed for their device",
  );
  const stranger = new Client(mf);
  const first = await stranger.request("/me");
  eq((await stranger.request("/orders/legacy-pending-0001")).status, 404, "Cross-device isolation");
  eq(
    (await stranger.request("/orders/legacy-paid-0002")).status,
    404,
    "Someone else's paid order hidden",
  );
  // A new visitor gets the 90-day guest cookie.
  const set = first.headers.get("set-cookie") ?? "";
  ok(
    /afnan_guest=[a-f0-9]{64}/.test(set) &&
      /Max-Age=7776000/.test(set) &&
      /HttpOnly/.test(set) &&
      /SameSite=Lax/.test(set),
    `90-day HttpOnly guest cookie: ${set}`,
  );
  ok(!/Secure/.test(set), "Secure flag only on HTTPS origins (local test origin is http)");

  // 4. Receipt with a transfer reference on a legacy order, then cancellation restores its stock.
  const png = await readFile("public/brand/afnan-collection-logo.png");
  const receipt = await guest.request(
    "/orders/legacy-pending-0001/receipts",
    "POST",
    new Uint8Array(png),
    {
      "Content-Type": "image/png",
      "X-Transfer-Reference": "MP-NEW-77",
    },
  );
  eq(receipt.status, 201, "Receipt on a legacy order");
  const stockBeforeCancel = await stock();
  // A receipt does not block a customer cancel of a pending order; cancellation releases 2 units.
  await guest.request("/orders/legacy-pending-0001/cancel", "POST", {});
  eq(await stock(), stockBeforeCancel + 2, "Cancellation restores the legacy reservation");
  eq((await one("SELECT status FROM orders WHERE id='legacy-pending-0001'")).status, "cancelled");
  eq(
    (
      await all("SELECT kind FROM admin_events WHERE order_id='legacy-pending-0001' ORDER BY rowid")
    ).map((e) => e.kind),
    ["receipt.uploaded", "order.cancelled"],
    "Events for the legacy order",
  );

  // 5. New order on the upgraded database: two selections, pickup, reservation, evidence, approval.
  const buyer = new Client(mf);
  await buyer.request("/me");
  const created = await buyer.request("/orders", "POST", {
    lines: [
      { variantId, qty: 1, note: "Colour: Red" },
      { variantId, qty: 2, note: "Colour: Blue" },
    ],
    customer: { name: "New Buyer", phone: "08012345678", email: "new@example.com" },
    fulfilmentMethod: "pickup",
    idempotencyKey: randomUUID(),
  });
  eq(created.status, 201, `New order: ${JSON.stringify(created.body.error ?? "")}`);
  const order = created.body;
  eq([order.delivery_kobo, order.total_kobo], [0, 750000], "Pickup free; 3 × ₦2,500");
  eq(await stock(), stockBeforeCancel + 2 - 3, "New order reserves 3 units");
  eq(
    JSON.parse(
      (await one("SELECT selections FROM order_items WHERE order_id=?", order.id)).selections,
    ),
    [
      { qty: 1, note: "Colour: Red" },
      { qty: 2, note: "Colour: Blue" },
    ],
    "Selections saved",
  );
  const newReceipt = await buyer.request(
    `/orders/${order.id}/receipts`,
    "POST",
    new Uint8Array(png),
    {
      "Content-Type": "image/png",
      "X-Transfer-Reference": "MP-NEW-78",
    },
  );
  eq(newReceipt.status, 201);
  const { statements, token: setup } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  await new Client(mf).request("/admin-setup", "POST", { token: setup, password: PASSWORD });
  const admin = new Client(mf);
  eq(
    (await admin.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD }))
      .status,
    200,
  );
  const review = (await admin.request("/admin/payment-review")).body;
  ok(
    review.some((o) => o.id === order.id && o.receipts[0].transfer_reference === "MP-NEW-78"),
    "Payment review shows the new order's reference",
  );
  // The 0008 unique index works against the approval written before the upgrade.
  const replay = await admin.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
    amountKobo: order.total_kobo,
    bankReference: "mp-legacy-1",
    creditConfirmed: true,
  });
  eq(replay.status, 409, "Reusing a pre-upgrade bank reference is refused");
  ok(
    replay.body.error.includes("AC-20261101-0002"),
    `Refusal names the legacy order: ${replay.body.error}`,
  );
  const approved = await admin.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
    amountKobo: order.total_kobo,
    bankReference: "MP-NEW-APPROVE-1",
    creditConfirmed: true,
    receiptId: newReceipt.body.id,
  });
  eq([approved.status, approved.body.outcome], [200, "paid"], "Approval on the upgraded database");

  // 6. Legacy expired order: a late payment is recorded for review; stock is not re-reserved.
  const stockBeforeLate = await stock();
  const lateOk = await admin.request(
    "/admin/orders/legacy-expired-0003/bank-transfer-approval",
    "POST",
    {
      amountKobo: before.orders.find((o) => o.id === "legacy-expired-0003").total_kobo,
      bankReference: "MP-LATE-0003",
      creditConfirmed: true,
    },
  );
  eq(lateOk.body.outcome, "late_review", "Legacy expired order takes a late-review decision");
  eq(await stock(), stockBeforeLate, "Late payment does not re-reserve stock");

  // 7. Notifications and email on the upgraded database, including a retry.
  const feed = (await admin.request("/admin/events")).body;
  for (const kind of [
    "order.created",
    "receipt.uploaded",
    "payment.verified",
    "payment.late_review",
    "order.cancelled",
  ])
    ok(
      feed.events.some((e) => e.kind === kind),
      `Inbox has ${kind}`,
    );
  const mail = await all(
    "SELECT e.kind,x.status,x.attempts FROM email_outbox x JOIN admin_events e ON e.id=x.event_id ORDER BY x.rowid",
  );
  ok(
    mail.length >= 4 && mail.every((m) => m.status === "test" && m.attempts === 1),
    `Staff emails delivered once: ${JSON.stringify(mail)}`,
  );
  await db
    .prepare("UPDATE email_outbox SET status='failed',next_attempt_at=0 WHERE event_id=?")
    .bind(`order.created:${order.id}`)
    .run();
  await admin.request("/admin/events");
  eq(
    await one(
      "SELECT status,attempts FROM email_outbox WHERE event_id=?",
      `order.created:${order.id}`,
    ),
    { status: "test", attempts: 2 },
    "Failed email retried once",
  );
  eq(
    (await one("SELECT quick_check FROM pragma_quick_check")).quick_check,
    "ok",
    "Integrity ok after the lifecycle",
  );
  console.log(`PASS: ${checks} upgrade-from-0006 preservation and checkout lifecycle checks`);
} finally {
  await mf.dispose();
}
