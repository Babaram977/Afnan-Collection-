// Owner-approved 2026-11-15: manual bank transfer, 24-hour reservation, admin-only approval.
import { enrollStaff } from "./authenticator.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// PAYMENT_MODE=disabled means Paystack is off, so every order is a manual bank transfer.
const { mf, db, variantId, zoneId } = await createTestApp({
  bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "disabled" },
});
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const stock = async () =>
  (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock;
const auditCount = async (action, id) =>
  (
    await db
      .prepare("SELECT COUNT(*) AS n FROM audit WHERE action=? AND entity_id=?")
      .bind(action, id)
      .first()
  ).n;
const makeOrder = (qty = 1) => ({
  lines: [{ variantId, qty }],
  zoneId,
  idempotencyKey: randomUUID(),
  customer: { name: "Fixture buyer", email: "guest@example.com", phone: "08012345678" },
  address: { street: "Fixture street 10", city: "Kano", state: "Kano" },
});
const forceExpiry = (id) =>
  db.prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?").bind(id).run();

try {
  await db.prepare("UPDATE variants SET stock=10 WHERE id=?").bind(variantId).run();
  const guest = new Client(mf);
  await guest.request("/me");

  // 1. 24-hour reservation from creation, recorded with the reserved lines.
  const before = Math.floor(Date.now() / 1000);
  const created = await guest.request("/orders", "POST", makeOrder(2));
  check(created.status === 201, `Bank-transfer order created: ${JSON.stringify(created.body)}`);
  const order = created.body;
  check(order.payment_method === "bank_transfer", "Paystack disabled → bank transfer");
  const window = order.expires_at - before;
  check(window >= 86400 - 5 && window <= 86400 + 5, `24-hour deadline (got ${window}s)`);
  check((await stock()) === 8, "Stock reserved at order creation");
  const createdAudit = await db
    .prepare("SELECT detail FROM audit WHERE action='order.created' AND entity_id=?")
    .bind(order.id)
    .first();
  const createdDetail = JSON.parse(createdAudit.detail);
  check(
    createdDetail.paymentMethod === "bank_transfer" && createdDetail.expiresAt === order.expires_at,
    "Reservation audited with method and deadline",
  );
  check(createdDetail.stockReserved?.[0]?.qty === 2, "Reserved quantities audited");

  // Short customer-facing reference + saved snapshot in the creation response.
  const lagosDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "");
  check(
    new RegExp(`^AC-${lagosDay}-\\d{4}$`).test(order.reference),
    `Reference AC-YYYYMMDD-NNNN in Lagos date (got ${order.reference})`,
  );
  check(order.items?.length === 1 && order.items[0].qty === 2, "Response carries item snapshot");
  check(
    order.total_kobo === order.delivery_kobo + order.items[0].price_kobo * 2,
    "Snapshot total = items + delivery",
  );
  const retry = await guest.request("/orders", "POST", {
    ...makeOrder(2),
    idempotencyKey: undefined,
  });
  check(retry.status === 400, "Malformed retry rejected");
  // Concurrent checkouts get distinct, sequential references; a failed checkout uses none.
  await db.prepare("UPDATE variants SET stock=stock+6 WHERE id=?").bind(variantId).run();
  const burst = await Promise.all(
    Array.from({ length: 6 }, () => new Client(mf)).map(async (c) => {
      await c.request("/me");
      return c.request("/orders", "POST", makeOrder(1));
    }),
  );
  const refs = burst.map((r) => r.body.reference);
  check(
    burst.every((r) => r.status === 201),
    "Concurrent checkouts succeed",
  );
  check(new Set(refs).size === refs.length, `Concurrent references unique: ${refs}`);
  const seq = refs.map((r) => Number(r.slice(-4))).sort((a, b) => a - b);
  check(
    seq.every((n, i) => i === 0 || n === seq[i - 1] + 1),
    `Concurrent references sequential: ${seq}`,
  );
  const counterBefore = (
    await db.prepare("SELECT last FROM order_reference_counters WHERE day=?").bind(lagosDay).first()
  ).last;
  const tooMany = await guest.request("/orders", "POST", makeOrder(99));
  check(tooMany.status === 409, "Out-of-stock checkout refused");
  check(
    (
      await db
        .prepare("SELECT last FROM order_reference_counters WHERE day=?")
        .bind(lagosDay)
        .first()
    ).last === counterBefore,
    "Failed checkout does not consume a reference number",
  );
  // Release the burst orders (each belongs to a different guest session).
  await db
    .prepare("UPDATE orders SET status='cancelled' WHERE status='pending' AND id<>?")
    .bind(order.id)
    .run();
  await db.prepare("UPDATE variants SET stock=8 WHERE id=?").bind(variantId).run();

  // 2. The customer's order view carries the deadline.
  const mine = await guest.request(`/orders/${order.id}`);
  check(mine.body.expires_at === order.expires_at, "Customer order shows payment deadline");

  // 4. Nothing may extend the deadline; Paystack initialisation is refused for this order.
  await assert.rejects(
    db.prepare("UPDATE orders SET expires_at=expires_at+3600 WHERE id=?").bind(order.id).run(),
    /cannot be extended/,
  );
  checks++;
  check(
    (await guest.request(`/orders/${order.id}/pay`, "POST", {})).status >= 400,
    "Online payment refused for bank-transfer order",
  );

  // 5. A bank-transfer order cannot become paid without a recorded staff approval.
  await assert.rejects(
    db.prepare("UPDATE orders SET status='paid' WHERE id=?").bind(order.id).run(),
    /requires staff approval/,
  );
  checks++;

  // 5. Only an MFA-verified admin may approve. Customer and fulfilment staff are refused.
  const approve = (client, id, amountKobo, bankReference = "MONIE-TEST-1") =>
    client.request(`/admin/orders/${id}/bank-transfer-approval`, "POST", {
      amountKobo,
      bankReference,
      creditConfirmed: true,
    });
  check((await approve(guest, order.id, order.total_kobo)).status === 401, "Guest cannot approve");
  const customer = new Client(mf);
  await customer.signIn(db);
  check(
    (await approve(customer, order.id, order.total_kobo)).status === 403,
    "Customer cannot approve",
  );
  const packer = new Client(mf);
  const packerUser = await packer.signIn(db, "packer@example.com");
  await enrollStaff(packer, db, packerUser.userId, "fulfilment");
  check(
    (await approve(packer, order.id, order.total_kobo)).status === 403,
    "Fulfilment staff cannot approve payments",
  );
  const unverifiedAdmin = new Client(mf);
  const unverified = await unverifiedAdmin.signIn(db, "nomfa@example.com");
  await db
    .prepare("INSERT INTO staff(user_id,role) VALUES(?,'admin')")
    .bind(unverified.userId)
    .run();
  check(
    (await approve(unverifiedAdmin, order.id, order.total_kobo)).status === 403,
    "Admin role without a WebAuthn admin session cannot approve",
  );
  const admin = new Client(mf);
  const adminUser = await admin.signIn(db, "admin@example.com");
  await enrollStaff(admin, db, adminUser.userId);
  check(
    (await approve(admin, order.id, order.total_kobo - 1)).status === 409,
    "Amount mismatch refused",
  );
  check(
    (
      await admin.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
        amountKobo: order.total_kobo,
        bankReference: "MONIE-NOCONFIRM",
      })
    ).status === 400,
    "Approval without explicit Moniepoint credit confirmation refused",
  );

  // 5/8. Approval within the window marks paid, audited, with no stock change.
  const ok = await approve(admin, order.id, order.total_kobo);
  check(ok.status === 200 && ok.body.outcome === "paid", `Approved: ${JSON.stringify(ok.body)}`);
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(order.id).first()).status ===
      "paid",
    "Order paid",
  );
  check((await stock()) === 8, "Approval does not change stock");
  check((await auditCount("payment.bank_transfer.approved", order.id)) === 1, "Approval audited");
  check(
    (await approve(admin, order.id, order.total_kobo)).status === 409,
    "Second approval refused",
  );
  check(
    (await auditCount("payment.bank_transfer.approved", order.id)) === 1,
    "Approval audited once",
  );
  await forceExpiry(order.id).catch(() => {});
  await guest.request("/products");
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(order.id).first()).status ===
      "paid",
    "Paid order never expires",
  );
  check((await stock()) === 8, "Paid order keeps its stock");

  // 3/8. Automatic expiry after the deadline releases stock exactly once, audited.
  const lapsed = (await guest.request("/orders", "POST", makeOrder(3))).body;
  check((await stock()) === 5, "Second order reserved");
  await forceExpiry(lapsed.id);
  await guest.request("/products");
  await guest.request("/products");
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(lapsed.id).first()).status ===
      "expired",
    "Unpaid order expired",
  );
  check((await stock()) === 8, "Expiry released stock once");
  check((await auditCount("order.expired", lapsed.id)) === 1, "Expiry audited once");
  const released = await db
    .prepare(
      "SELECT COALESCE(SUM(delta),0) AS d FROM inventory_movements WHERE order_id=? AND reason='expired'",
    )
    .bind(lapsed.id)
    .first();
  check(released.d === 3, "Stock release recorded in inventory movements");

  // 6. Late payment: flagged for review, order not reactivated, no stock re-reserved.
  const late = await approve(admin, lapsed.id, lapsed.total_kobo, "MONIE-LATE-1");
  check(
    late.status === 200 && late.body.outcome === "late_review",
    `Late payment flagged: ${JSON.stringify(late.body)}`,
  );
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(lapsed.id).first()).status ===
      "expired",
    "Late payment does not reactivate order",
  );
  check((await stock()) === 8, "Late payment does not re-reserve stock");
  check(
    (await auditCount("payment.bank_transfer.late_review", lapsed.id)) === 1,
    "Late review audited",
  );
  const detail = await admin.request(`/admin/orders/${lapsed.id}`);
  check(detail.body.bankTransferApproval?.outcome === "late_review", "Admin sees review flag");

  // 6. Deadline passed but expiry not yet swept: approval still treats it as late.
  const edge = (await guest.request("/orders", "POST", makeOrder(1))).body;
  await forceExpiry(edge.id);
  const edgeResult = await approve(admin, edge.id, edge.total_kobo, "MONIE-EDGE-1");
  check(edgeResult.body.outcome === "late_review", "Past-deadline approval is late review");
  check((await stock()) === 8, "Past-deadline order released, not paid");

  // 9. Concurrent expiry and approval at the deadline never double-change stock.
  // Repeat the race and report the ratio rather than trusting one run.
  const runs = 20;
  await db.prepare("UPDATE variants SET stock=stock+? WHERE id=?").bind(runs, variantId).run();
  let consistent = 0;
  const outcomes = { paid: 0, late_review: 0 };
  for (let i = 0; i < runs; i++) {
    const startStock = await stock();
    const placed = await guest.request("/orders", "POST", makeOrder(1));
    assert.equal(placed.status, 201, `Race order ${i}: ${JSON.stringify(placed.body)}`);
    const racer = placed.body;
    // Deadline at the next whole second; fire within a few ms either side of it.
    const deadline = Math.floor(Date.now() / 1000) + 1;
    await db.prepare("UPDATE orders SET expires_at=? WHERE id=?").bind(deadline, racer.id).run();
    // Approval does auth work before deciding, so fire it up to ~400 ms early.
    const offset = [-400, -250, -150, -80, -20][i % 5];
    await new Promise((r) => setTimeout(r, Math.max(0, deadline * 1000 + offset - Date.now())));
    const [decision] = await Promise.all([
      approve(admin, racer.id, racer.total_kobo, `RACE-${i}`),
      guest.request("/products"),
      customer.request("/products"),
    ]);
    await guest.request("/products");
    const row = await db.prepare("SELECT status FROM orders WHERE id=?").bind(racer.id).first();
    const end = await stock();
    const movements = await db
      .prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE order_id=?")
      .bind(racer.id)
      .first();
    const audits = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM audit WHERE entity_id=? AND action LIKE 'payment.bank_transfer.%'",
      )
      .bind(racer.id)
      .first();
    if (decision.body?.outcome) outcomes[decision.body.outcome]++;
    const paidOk = row.status === "paid" && end === startStock - 1 && movements.n === 1;
    const expiredOk = row.status === "expired" && end === startStock && movements.n === 2;
    if ((paidOk || expiredOk) && audits.n === 1) consistent++;
  }
  console.log(
    `Concurrent approval/expiry: ${consistent}/${runs} consistent (paid ${outcomes.paid}, late ${outcomes.late_review})`,
  );
  check(consistent === runs, `Race consistency ${consistent}/${runs}`);

  // 7. Paystack keeps its 30-minute window when enabled (fixture mode).
  const {
    mf: mf2,
    db: db2,
    variantId: v2,
    zoneId: z2,
  } = await createTestApp({
    bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "fixture" },
  });
  try {
    const shopper = new Client(mf2);
    await shopper.request("/me");
    const t0 = Math.floor(Date.now() / 1000);
    const paystack = (
      await shopper.request("/orders", "POST", {
        ...makeOrder(1),
        lines: [{ variantId: v2, qty: 1 }],
        zoneId: z2,
      })
    ).body;
    check(paystack.payment_method === "paystack", "Paystack enabled → Paystack order");
    const w = paystack.expires_at - t0;
    check(w >= 1800 - 5 && w <= 1800 + 5, `Paystack keeps 30-minute window (got ${w}s)`);
    await db2
      .prepare("UPDATE orders SET expires_at=expires_at+60 WHERE id=?")
      .bind(paystack.id)
      .run();
    checks++;
  } finally {
    await mf2.dispose();
  }

  // 2. Browser: the confirmation page shows the 24-hour deadline and the bank details.
  await mf.dispose();
  const ui = await createTestApp({
    port: 8787,
    bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "disabled" },
  });
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${ORIGIN}/shop`);
      await page
        .getByRole("link", { name: /Test fixture romper/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();
      await page.goto(`${ORIGIN}/checkout`);
      await page.getByLabel("Delivery area").selectOption(ui.zoneId);
      await page.getByLabel("Full name", { exact: true }).fill("Browser fixture buyer");
      await page.getByLabel("Phone", { exact: true }).fill("08012345678");
      await page.getByLabel("Email", { exact: true }).fill(`bank-${width}@example.com`);
      await page.getByLabel("Street address", { exact: true }).fill("Fixture street 10");
      await page.getByLabel("City", { exact: true }).fill("Kano");
      await page.getByRole("button", { name: "Prepare order", exact: true }).click();
      await page.getByRole("heading", { name: "Order prepared" }).waitFor({ timeout: 10000 });
      const main = await page.locator("#main").innerText();
      check(/Pay by:/.test(main) && /24 hours/.test(main), `Deadline shown at ${width}`);
      const iso = await page.locator("time").getAttribute("datetime");
      const shown = (Date.parse(iso) - Date.now()) / 1000;
      check(shown > 86400 - 120 && shown <= 86400, `Displayed deadline is 24h ahead at ${width}`);
      check(
        main.includes("Moniepoint Microfinance Bank") &&
          main.includes("7035963225") &&
          main.includes("Afnan Collection"),
        `Bank details shown at ${width}`,
      );
      check(!/30 minutes/.test(main), `No Paystack 30-minute copy at ${width}`);
      check(/Order reference: AC-\d{8}-\d{4}/.test(main), `Short reference shown at ${width}`);
      const summary = await page.locator("aside").innerText();
      const confirmTotal = main.match(/Total: (₦[\d,]+)/)?.[1];
      check(
        Boolean(confirmTotal) && summary.includes(`Order total: ${confirmTotal}`),
        `Summary total matches order total at ${width}: ${confirmTotal} / ${summary.replace(/\n/g, " | ")}`,
      );
      check(!/Subtotal: ₦0\b/.test(summary), `Summary not built from empty cart at ${width}`);
      check(
        (await page.getByRole("button", { name: "Continue to payment" }).count()) === 0,
        `No online payment button at ${width}`,
      );
      check(
        (await page.getByRole("button", { name: "Copy account number" }).count()) === 1,
        `Copy button at ${width}`,
      );
      check(
        !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `No horizontal overflow at ${width}`,
      );
      const axe = await new AxeBuilder({ page }).include("#main").analyze();
      const serious = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
      check(
        serious.length === 0,
        `No serious a11y issues at ${width}: ${serious.map((v) => v.id)}`,
      );
      check(errors.length === 0, `No page errors at ${width}: ${errors}`);
      if (process.env.BANK_TRANSFER_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.BANK_TRANSFER_SCREENSHOTS}/bank-transfer-${width}.png`,
          fullPage: true,
        });
      await page.goto(`${ORIGIN}/account`);
      check(new URL(page.url()).pathname === "/", `Retired account redirects at ${width}`);
      const preservedOrders = await (await page.request.get(`${ORIGIN}/api/orders`)).json();
      check(
        preservedOrders.some(
          (o) => o.payment_method === "bank_transfer" && typeof o.expires_at === "number",
        ),
        `Existing transfer records and deadlines remain available to their owner at ${width}`,
      );
      check(
        (await page.getByRole("button", { name: "Continue to payment" }).count()) === 0,
        `Retired account offers no payment controls at ${width}`,
      );

      await context.close();
    }
  } finally {
    await browser.close();
    await ui.mf.dispose();
  }

  console.log(
    `PASS: ${checks} bank-transfer reservation, approval, expiry, race and UI assertions`,
  );
} finally {
  await mf.dispose().catch(() => {});
}
