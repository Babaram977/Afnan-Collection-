// Owner-approved 2026-11-15: bank-transfer receipts (private R2) and admin payment review.
import { enrollStaff } from "./authenticator.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
// Minimal structurally valid files, built in memory (no real customer data). `tag` makes each
// file unique so duplicate detection does not collapse unrelated uploads.
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
};
const makePng = (tag = randomUUID()) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])),
    chunk("tEXt", Buffer.from(`Comment\0${tag}`)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
const makeJpeg = (tag = randomUUID()) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from("JFIF\0"),
    Buffer.alloc(120),
    Buffer.from(tag),
    Buffer.from([0xff, 0xd9]),
  ]);
const makeWebp = (tag = randomUUID()) => {
  const body = Buffer.concat([
    Buffer.from("WEBPVP8 "),
    Buffer.alloc(4),
    Buffer.alloc(16),
    Buffer.from(tag),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from("RIFF"), size, body]);
};
const makePdf = (extra = "", tag = randomUUID()) =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R ${extra} >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n% ${tag}\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
  );
const png = makePng();
const jpeg = makeJpeg();
const webp = makeWebp();
const pdf = makePdf();
const sha = (b) => createHash("sha256").update(b).digest("hex");

const { mf, db, variantId, zoneId } = await createTestApp({
  bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "disabled" },
});
const receipts = await mf.getR2Bucket("RECEIPTS");
const media = await mf.getR2Bucket("MEDIA");
const makeOrder = (qty = 1) => ({
  lines: [{ variantId, qty }],
  zoneId,
  idempotencyKey: randomUUID(),
  customer: { name: "Fixture buyer", email: "guest@example.com", phone: "08012345678" },
  address: { street: "Fixture street 10", city: "Kano", state: "Kano" },
});
// Each upload comes from its own simulated IP so the per-IP rate limit (tested explicitly
// below) does not interfere with the other assertions.
let ipCounter = 0;
const upload = (client, orderId, bytes, type = "application/octet-stream", headers = {}) =>
  client.request(`/orders/${orderId}/receipts`, "POST", new Uint8Array(bytes), {
    "Content-Type": type,
    "CF-Connecting-IP": `198.51.100.${(ipCounter++ % 250) + 1}`,
    ...headers,
  });
const count = async (sql, ...args) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .first()
  ).n;

try {
  await db.prepare("UPDATE variants SET stock=20 WHERE id=?").bind(variantId).run();
  const guest = new Client(mf);
  await guest.request("/me");
  const order = (await guest.request("/orders", "POST", makeOrder(1))).body;
  check(order.payment_method === "bank_transfer", "Bank-transfer order");
  const deadline = order.expires_at;

  // Content validation, size limit and type spoofing.
  for (const [name, bytes] of [
    ["PNG", png],
    ["JPEG", jpeg],
    ["WebP", webp],
    ["PDF", pdf],
  ]) {
    const throwaway = (await guest.request("/orders", "POST", makeOrder(1))).body;
    const r = await upload(guest, throwaway.id, bytes);
    check(r.status === 201, `${name} receipt accepted: ${JSON.stringify(r.body)}`);
  }
  check(
    (await upload(guest, order.id, Buffer.from("GIF89a fake"), "image/png")).status === 415,
    "Declared image/png with GIF content rejected (content, not header, decides)",
  );
  check(
    (
      await upload(
        guest,
        order.id,
        Buffer.from("<html><script>alert(1)</script>"),
        "application/pdf",
      )
    ).status === 415,
    "HTML disguised as PDF rejected",
  );
  check(
    (await upload(guest, order.id, Buffer.from("%PDF-1.4 no end marker here at all......")))
      .status === 415,
    "Truncated PDF without %%EOF rejected",
  );
  // Structure checks: truncated or malformed images and unsafe PDFs are refused with a reason.
  const truncatedPng = makePng().subarray(0, 40);
  const noIhdr = Buffer.from(makePng()).fill(0x41, 12, 16);
  const badJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0x00]), Buffer.alloc(200)]);
  const lyingWebp = makeWebp();
  lyingWebp.writeUInt32LE(0xffffff, 4);
  for (const [label, bytes, expect] of [
    ["Truncated PNG", truncatedPng, /damaged or incomplete/],
    ["PNG without IHDR", noIhdr, /damaged or incomplete/],
    ["JPEG with invalid marker", badJpeg, /damaged or incomplete/],
    ["WebP with impossible size", lyingWebp, /damaged or incomplete/],
    [
      "PDF with JavaScript",
      makePdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"),
      /scripts, attachments or forms/,
    ],
    ["PDF with /JS only", makePdf("/AA << /O << /JS (x) >> >>"), /scripts, attachments or forms/],
    [
      "PDF with Launch action",
      makePdf("/OpenAction << /S /Launch /F (cmd.exe) >>"),
      /scripts, attachments or forms/,
    ],
    [
      "PDF with embedded file",
      makePdf("/Names << /EmbeddedFiles << /Names [] >> >>"),
      /scripts, attachments or forms/,
    ],
    ["PDF with XFA form", makePdf("/AcroForm << /XFA 5 0 R >>"), /scripts, attachments or forms/],
    ["Encrypted PDF", makePdf("/Encrypt 9 0 R"), /password-protected/],
  ]) {
    const r = await upload(guest, order.id, bytes);
    check(
      r.status === 415 && expect.test(r.body.error),
      `${label} refused with reason (${r.status} ${r.body.error})`,
    );
  }
  const plainPdfOrder = (await guest.request("/orders", "POST", makeOrder(1))).body;
  check(
    (await upload(guest, plainPdfOrder.id, makePdf("/OpenAction 3 0 R /PageMode /UseNone")))
      .status === 201,
    "Plain PDF with a harmless OpenAction is still accepted",
  );

  const big = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
  check((await upload(guest, order.id, big)).status === 413, "Over 5 MB rejected");
  check((await upload(guest, order.id, Buffer.alloc(0))).status === 400, "Empty upload rejected");

  // Ownership: another guest, a signed-in stranger and cross-site requests cannot upload.
  const stranger = new Client(mf);
  await stranger.request("/me");
  check((await upload(stranger, order.id, png)).status === 404, "Other guest cannot upload");
  const customer = new Client(mf);
  await customer.signIn(db);
  check((await upload(customer, order.id, png)).status === 404, "Other customer cannot upload");
  check(
    (await upload(guest, order.id, png, "image/png", { Origin: "https://evil.example" })).status ===
      403,
    "Cross-site upload rejected",
  );
  check(
    (await count("SELECT COUNT(*) AS n FROM payment_receipts WHERE order_id=?", order.id)) === 0,
    "Rejected uploads stored nothing",
  );

  // Valid upload by the owner: private storage, random key, audit, notification, no state change.
  const stockBefore = (
    await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()
  ).stock;
  const first = await upload(guest, order.id, png, "image/png");
  check(first.status === 201 && first.body.status === "submitted", "Owner upload accepted");
  check(
    !("object_key" in first.body) && !JSON.stringify(first.body).includes("receipts/"),
    "Upload response hides storage key",
  );
  const row = await db
    .prepare("SELECT object_key,sha256,content_type,bytes,status FROM payment_receipts WHERE id=?")
    .bind(first.body.id)
    .first();
  check(
    row.object_key.startsWith(`receipts/${order.id}/`) &&
      /[0-9a-f-]{36}\.png$/.test(row.object_key),
    "Random per-order storage key",
  );
  check(
    row.sha256 === sha(png) && row.bytes === png.length && row.content_type === "image/png",
    "Metadata recorded from content",
  );
  const stored = await receipts.get(row.object_key);
  check(
    stored && sha(Buffer.from(await stored.arrayBuffer())) === sha(png),
    "Stored byte-for-byte in RECEIPTS",
  );
  check((await media.list()).objects.length === 0, "Nothing written to public MEDIA bucket");
  const after = await db
    .prepare("SELECT status,expires_at FROM orders WHERE id=?")
    .bind(order.id)
    .first();
  check(after.status === "pending", "Receipt does not mark the order paid");
  check(after.expires_at === deadline, "Receipt does not extend the deadline");
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock ===
      stockBefore,
    "Receipt does not change stock",
  );
  check(
    (await count(
      "SELECT COUNT(*) AS n FROM audit WHERE action='payment.receipt.submitted' AND entity_id=?",
      order.id,
    )) === 1,
    "Submission audited",
  );
  const notification = await db
    .prepare("SELECT recipient,status,attempts FROM notifications WHERE order_id=?")
    .bind(order.id)
    .first();
  check(
    notification.recipient === "sales@afnancollectionkn.com" &&
      notification.status === "test" &&
      notification.attempts === 1,
    `Staff notification recorded: ${JSON.stringify(notification)}`,
  );

  // Duplicate submission is idempotent; customer view shows status only.
  const dup = await upload(guest, order.id, png, "image/png");
  check(
    dup.status === 200 && dup.body.duplicate === true && dup.body.id === first.body.id,
    "Duplicate receipt idempotent",
  );
  check(
    (await count("SELECT COUNT(*) AS n FROM payment_receipts WHERE order_id=?", order.id)) === 1,
    "Duplicate stored once",
  );
  check(
    (await count("SELECT COUNT(*) AS n FROM notifications WHERE order_id=?", order.id)) === 1,
    "Duplicate not re-notified",
  );
  const view = (await guest.request(`/orders/${order.id}`)).body;
  check(
    view.paymentStatus === "Receipt Submitted",
    `Customer sees Receipt Submitted (${view.paymentStatus})`,
  );
  check(
    view.receipts.length === 1 && !JSON.stringify(view).includes("receipts/"),
    "Customer view has no storage key",
  );

  // Per-order limit holds under concurrent uploads.
  const capped = (await guest.request("/orders", "POST", makeOrder(1))).body;
  const many = await Promise.all(
    Array.from({ length: 8 }, () => upload(guest, capped.id, makePng())),
  );
  check(
    many.filter((r) => r.status === 201).length === 5,
    `Exactly 5 receipts accepted concurrently (${many.map((r) => r.status)})`,
  );
  check(
    (await count("SELECT COUNT(*) AS n FROM payment_receipts WHERE order_id=?", capped.id)) === 5,
    "Limit enforced in DB",
  );
  const keys = (await receipts.list({ prefix: `receipts/${capped.id}/` })).objects.length;
  check(keys === 5, `Refused uploads left no orphan objects (${keys})`);

  // Admin access to receipts: guests, customers, fulfilment staff and admins without MFA refused.
  const receiptPath = `/admin/receipts/${first.body.id}`;
  check((await guest.request(receiptPath)).status === 401, "Guest cannot view receipt");
  check((await customer.request(receiptPath)).status === 403, "Customer cannot view receipt");
  const packer = new Client(mf);
  const packerUser = await packer.signIn(db, "packer@example.com");
  await enrollStaff(packer, db, packerUser.userId, "fulfilment");
  check(
    (await packer.request(receiptPath)).status === 403,
    "Fulfilment staff cannot view receipts",
  );
  check(
    (await packer.request("/admin/payment-review")).status === 403,
    "Fulfilment staff cannot see review queue",
  );
  const noMfa = new Client(mf);
  const noMfaUser = await noMfa.signIn(db, "nomfa@example.com");
  await db
    .prepare("INSERT INTO staff(user_id,role) VALUES(?,'admin')")
    .bind(noMfaUser.userId)
    .run();
  check(
    (await noMfa.request(receiptPath)).status === 403,
    "Admin without WebAuthn session cannot view receipts",
  );
  const admin = new Client(mf);
  const adminUser = await admin.signIn(db, "admin@example.com");
  await enrollStaff(admin, db, adminUser.userId);
  const served = await mf.dispatchFetch(`${ORIGIN}/api${receiptPath}`, {
    headers: {
      Cookie: [...admin.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      "CF-Connecting-IP": admin.ip,
    },
  });
  check(served.status === 200, "Admin can view receipt");
  check(sha(Buffer.from(await served.arrayBuffer())) === sha(png), "Served receipt matches upload");
  check(/\bno-store\b/.test(served.headers.get("Cache-Control") ?? ""), "Receipt never cached");
  check(served.headers.get("X-Content-Type-Options") === "nosniff", "Receipt nosniff");
  check(/sandbox/.test(served.headers.get("Content-Security-Policy") ?? ""), "Receipt sandboxed");
  check(
    (await count(
      "SELECT COUNT(*) AS n FROM audit WHERE action='payment.receipt.viewed' AND entity_id=?",
      order.id,
    )) === 1,
    "Receipt view audited",
  );
  const pdfOrder = (await guest.request("/orders", "POST", makeOrder(1))).body;
  const pdfReceipt = (await upload(guest, pdfOrder.id, pdf)).body;
  const pdfServed = await mf.dispatchFetch(`${ORIGIN}/api/admin/receipts/${pdfReceipt.id}`, {
    headers: {
      Cookie: [...admin.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      "CF-Connecting-IP": admin.ip,
    },
  });
  await pdfServed.arrayBuffer();
  check(
    /^attachment;/.test(pdfServed.headers.get("Content-Disposition") ?? ""),
    "PDF receipts download, never render inline",
  );
  check(
    (await guest.request(`/../media/${row.object_key}`)).status >= 400,
    "Receipts unreachable via public media",
  );
  const publicMedia = await mf.dispatchFetch(`${ORIGIN}/media/${row.object_key.split("/").pop()}`);
  await publicMedia.arrayBuffer();
  check(publicMedia.status === 404, "Receipt key not served by /media");

  // Review queue and overview.
  const queue = (await admin.request("/admin/payment-review")).body;
  const queued = queue.find((o) => o.id === order.id);
  check(
    queued && queued.reference === order.reference && queued.receipts.length === 1,
    "Order in review queue with receipt",
  );
  check(!JSON.stringify(queue).includes("receipts/"), "Queue exposes no storage keys");
  check(
    (await admin.request("/admin/overview")).body.paymentsAwaitingReview >= 1,
    "Overview counts payments awaiting review",
  );

  // Reject → customer can resubmit; decision is final and audited.
  check(
    (await admin.request(`/admin/receipts/${first.body.id}/reject`, "POST", { reason: "x" }))
      .status === 400,
    "Rejection needs a reason",
  );
  const rejected = await admin.request(`/admin/receipts/${first.body.id}/reject`, "POST", {
    reason: "Amount on receipt does not match",
  });
  check(rejected.status === 200, "Admin rejects receipt");
  check(
    (
      await admin.request(`/admin/receipts/${first.body.id}/reject`, "POST", {
        reason: "Again please",
      })
    ).status === 409,
    "Second rejection refused",
  );
  check(
    (await count(
      "SELECT COUNT(*) AS n FROM audit WHERE action='payment.receipt.rejected' AND entity_id=?",
      order.id,
    )) === 1,
    "Rejection audited once",
  );
  check(
    (await guest.request(`/orders/${order.id}`)).body.paymentStatus === "Rejected",
    "Customer sees Rejected",
  );
  await assert.rejects(
    db
      .prepare("UPDATE payment_receipts SET status='accepted' WHERE id=?")
      .bind(first.body.id)
      .run(),
    /decision is final/,
  );
  checks++;
  const second = await upload(guest, order.id, jpeg, "image/jpeg");
  check(second.status === 201, "Customer resubmits after rejection");

  // Approval requires MFA admin + explicit credit confirmation; marks receipt accepted; once only.
  const approve = (client, body) =>
    client.request(`/admin/orders/${order.id}/bank-transfer-approval`, "POST", {
      amountKobo: order.total_kobo,
      bankReference: "MONIE-RCPT-1",
      creditConfirmed: true,
      receiptId: second.body.id,
      ...body,
    });
  check((await approve(packer, {})).status === 403, "Fulfilment staff cannot approve");
  check((await approve(noMfa, {})).status === 403, "Admin without MFA cannot approve");
  check(
    (await approve(admin, { creditConfirmed: false })).status === 400,
    "Unconfirmed credit refused",
  );
  check(
    (await approve(admin, { receiptId: first.body.id })).status === 409,
    "Cannot approve against a rejected receipt",
  );
  check(
    (await approve(admin, { receiptId: pdfReceipt.id })).status === 404,
    "Cannot approve with another order's receipt",
  );
  const approved = await approve(admin, {});
  check(
    approved.status === 200 && approved.body.outcome === "paid",
    `Approved: ${JSON.stringify(approved.body)}`,
  );
  check(
    (
      await db
        .prepare("SELECT status FROM payment_receipts WHERE id=?")
        .bind(second.body.id)
        .first()
    ).status === "accepted",
    "Reviewed receipt accepted",
  );
  check((await approve(admin, {})).status === 409, "Duplicate approval refused");
  check(
    (await count(
      "SELECT COUNT(*) AS n FROM audit WHERE action='payment.bank_transfer.approved' AND entity_id=?",
      order.id,
    )) === 1,
    "Approval audited once",
  );
  const approvalAudit = JSON.parse(
    (
      await db
        .prepare(
          "SELECT detail FROM audit WHERE action='payment.bank_transfer.approved' AND entity_id=?",
        )
        .bind(order.id)
        .first()
    ).detail,
  );
  check(
    approvalAudit.creditConfirmed === 1 && approvalAudit.receiptId === second.body.id,
    "Audit records confirmation and receipt",
  );
  check(
    (await guest.request(`/orders/${order.id}`)).body.paymentStatus === "Paid",
    "Customer sees Paid",
  );
  check((await upload(guest, order.id, webp)).status === 409, "No uploads after payment approved");

  // Expired order: evidence accepted for manual review; never reactivated, no stock re-reserved.
  const lapsed = (await guest.request("/orders", "POST", makeOrder(2))).body;
  await db.prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?").bind(lapsed.id).run();
  await guest.request("/products");
  const stockAfterExpiry = (
    await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()
  ).stock;
  const lateReceipt = await upload(guest, lapsed.id, jpeg);
  check(lateReceipt.status === 201, "Late evidence accepted for review");
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(lapsed.id).first()).status ===
      "expired",
    "Late receipt does not reactivate order",
  );
  check(
    (await guest.request(`/orders/${lapsed.id}`)).body.paymentStatus ===
      "Expired — Late Payment Under Review",
    "Customer sees expired-under-review, distinct from cancelled",
  );
  const lateQueue = (await admin.request("/admin/payment-review")).body.find(
    (o) => o.id === lapsed.id,
  );
  check(
    lateQueue?.queue_state === "expired_review",
    `Admin queue marks expired order (${lateQueue?.queue_state})`,
  );
  const activeQueue = (await admin.request("/admin/payment-review")).body.filter(
    (o) => o.status === "pending",
  );
  check(
    activeQueue.length > 0 && activeQueue.every((o) => o.queue_state.startsWith("active_")),
    "Active unpaid orders are never labelled expired",
  );
  const lateAudit = JSON.parse(
    (
      await db
        .prepare(
          "SELECT detail FROM audit WHERE action='payment.receipt.submitted' AND entity_id=?",
        )
        .bind(lapsed.id)
        .first()
    ).detail,
  );
  check(lateAudit.afterDeadline === true, "Late submission flagged in audit");
  check(
    (await admin.request("/admin/payment-review")).body.some((o) => o.id === lapsed.id),
    "Expired order with evidence in review queue",
  );
  const late = await admin.request(`/admin/orders/${lapsed.id}/bank-transfer-approval`, "POST", {
    amountKobo: lapsed.total_kobo,
    bankReference: "MONIE-LATE-RCPT",
    creditConfirmed: true,
    receiptId: lateReceipt.body.id,
  });
  check(late.body.outcome === "late_review", "Late payment recorded for manual review");
  check(
    (await db.prepare("SELECT status FROM orders WHERE id=?").bind(lapsed.id).first()).status ===
      "expired" &&
      (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock ===
        stockAfterExpiry,
    "Late approval leaves order expired and stock untouched",
  );

  const silent = (await guest.request("/orders", "POST", makeOrder(1))).body;
  await db.prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?").bind(silent.id).run();
  check(
    (await guest.request(`/orders/${silent.id}`)).body.paymentStatus === "Expired",
    "Expired without evidence shows Expired",
  );
  check(
    !(await admin.request("/admin/payment-review")).body.some((o) => o.id === silent.id),
    "Expired order without evidence leaves the review queue",
  );

  // Per-IP upload rate limit: 10 per minute.
  const limitedOrder = (await guest.request("/orders", "POST", makeOrder(1))).body;
  const burst = [];
  for (let i = 0; i < 11; i++)
    burst.push(
      (
        await upload(guest, limitedOrder.id, Buffer.from("not a receipt " + i), "image/png", {
          "CF-Connecting-IP": "203.0.113.77",
        })
      ).status,
    );
  check(
    burst.slice(0, 10).every((s) => s === 415) && burst[10] === 429,
    `11th upload in a minute rate-limited (${burst})`,
  );

  // Paystack-style and cancelled orders refuse receipts.
  const cancelled = (await guest.request("/orders", "POST", makeOrder(1))).body;
  await guest.request(`/orders/${cancelled.id}/cancel`, "POST", {});
  check(
    (await upload(guest, cancelled.id, png)).status === 409,
    "Cancelled order refuses receipts",
  );
  check(
    (await guest.request(`/orders/${cancelled.id}`)).body.paymentStatus === "Cancelled",
    "Cancelled shows Cancelled",
  );

  console.log(
    `PASS: ${checks} receipt upload, private storage, access control and review assertions`,
  );
} finally {
  await mf.dispose();
}

// Browser: customer upload on the confirmation page, admin review page renders accessibly.
{
  const ui = await createTestApp({
    port: 8787,
    bindings: { CHECKOUT_ENABLED: "true", PAYMENT_MODE: "disabled" },
  });
  const browser = await chromium.launch();
  let uiChecks = 0;
  const uiCheck = (c, m) => {
    assert.ok(c, m);
    uiChecks++;
  };
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
      await page.getByLabel("Email", { exact: true }).fill(`receipt-${width}@example.com`);
      await page.getByLabel("Street address", { exact: true }).fill("Fixture street 10");
      await page.getByLabel("City", { exact: true }).fill("Kano");
      await page.getByRole("button", { name: "Prepare order", exact: true }).click();
      await page.getByRole("heading", { name: "Order prepared" }).waitFor({ timeout: 10000 });
      uiCheck(
        /upload your receipt for verification/.test(await page.locator("#main").innerText()),
        `Receipt instruction shown at ${width}`,
      );
      await page.getByLabel("Upload your payment receipt").setInputFiles({
        name: "transfer.png",
        mimeType: "image/png",
        buffer: makePng(String(width)),
      });
      await page.getByRole("button", { name: "Submit receipt" }).click();
      await page.getByText("Receipt received.").waitFor({ timeout: 10000 });
      uiCheck(true, `Receipt uploaded from confirmation page at ${width}`);
      await page.getByLabel("Upload your payment receipt").setInputFiles({
        name: "not-a-receipt.png",
        mimeType: "image/png",
        buffer: Buffer.from("GIF89a definitely not png"),
      });
      await page.getByRole("button", { name: "Submit receipt" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "JPEG, PNG, WebP or PDF" })
        .waitFor({ timeout: 10000 });
      uiCheck(true, `Invalid file explained to customer at ${width}`);
      uiCheck(
        !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `No overflow at ${width}`,
      );
      const axe = await new AxeBuilder({ page }).include("#main").analyze();
      const serious = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
      uiCheck(
        serious.length === 0,
        `No serious a11y issues at ${width}: ${serious.map((v) => v.id)}`,
      );
      uiCheck(errors.length === 0, `No page errors at ${width}: ${errors}`);
      if (process.env.RECEIPT_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.RECEIPT_SCREENSHOTS}/receipt-upload-${width}.png`,
          fullPage: true,
        });
      await context.close();
    }
    uiCheck(
      (await ui.db.prepare("SELECT COUNT(*) AS n FROM payment_receipts").first()).n === 2,
      "Browser uploads stored (invalid ones refused)",
    );
    // Admin payment review renders active and expired orders apart, with MFA sign-in.
    const makeUiOrder = async () => {
      const shopper = new Client(ui.mf);
      await shopper.request("/me");
      const placed = await shopper.request("/orders", "POST", {
        lines: [{ variantId: ui.variantId, qty: 1 }],
        zoneId: ui.zoneId,
        idempotencyKey: randomUUID(),
        customer: { name: "Queue fixture buyer", email: "queue@example.com", phone: "08012345678" },
        address: { street: "Fixture street 10", city: "Kano", state: "Kano" },
      });
      return { shopper, order: placed.body };
    };
    await ui.db.prepare("UPDATE variants SET stock=stock+10 WHERE id=?").bind(ui.variantId).run();
    const late = await makeUiOrder();
    await late.shopper.request(
      `/orders/${late.order.id}/receipts`,
      "POST",
      new Uint8Array(makePng()),
      {
        "Content-Type": "image/png",
      },
    );
    await ui.db
      .prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?")
      .bind(late.order.id)
      .run();
    const waiting = await makeUiOrder();
    await ui.db.prepare("DELETE FROM rate_limits").run();
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.31" },
    });
    const adminPage = await adminContext.newPage();
    const adminErrors = [];
    adminPage.on("pageerror", (e) => adminErrors.push(e.message));
    await adminPage.goto(`${ORIGIN}/admin`);
    await adminPage.getByLabel("Email", { exact: true }).fill("review-admin@example.com");
    await adminPage.getByLabel("Name", { exact: true }).fill("Review admin");
    await adminPage.getByRole("button", { name: "Send sign-in code" }).click();
    await adminPage.getByLabel("Email code").waitFor();
    const { code } = await ui.db
      .prepare("SELECT code FROM test_outbox WHERE email=?")
      .bind("review-admin@example.com")
      .first();
    await adminPage.getByLabel("Email code").fill(code);
    await adminPage.getByRole("button", { name: "Verify and sign in" }).click();
    await adminPage.getByText("Staff access is required.", { exact: false }).waitFor();
    await ui.db
      .prepare(
        "INSERT INTO staff(user_id,role) SELECT id,'admin' FROM user WHERE email='review-admin@example.com'",
      )
      .run();
    await ui.db
      .prepare(
        "INSERT INTO admin_security(user_id,state,approval_ref,verified_by) SELECT id,'pending','fixture-evidence','fixture-operator' FROM user WHERE email='review-admin@example.com'",
      )
      .run();
    const cdp = await adminContext.newCDPSession(adminPage);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "usb",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    await adminPage.reload();
    await adminPage.getByRole("button", { name: "Enroll passkey or security key" }).click();
    await adminPage.getByRole("button", { name: "I saved my recovery codes" }).click();
    await adminPage.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
    await adminPage.getByRole("button", { name: "Payments", exact: true }).click();
    await adminPage.getByRole("heading", { name: /Bank-transfer payments/ }).waitFor();
    const activeSection = adminPage.getByRole("region", { name: /^Active — receipt submitted/ });
    const expiredSection = adminPage.getByRole("region", { name: /^Expired — manual review only/ });
    const awaitingSection = adminPage.getByRole("region", { name: /^Active — awaiting transfer/ });
    await expiredSection.waitFor();
    uiCheck(
      (await activeSection.getByText("Active · receipt to review").count()) >= 2,
      "Active-with-receipt section and badges",
    );
    uiCheck(
      (await expiredSection.getByText(`Order ${late.order.reference}`).count()) === 1,
      "Expired order listed under Expired",
    );
    uiCheck(
      (await activeSection.getByText(`Order ${late.order.reference}`).count()) === 0,
      "Expired order not in active section",
    );
    uiCheck(
      (await expiredSection.getByText("Expired · manual review").count()) === 1,
      "Expired badge shown",
    );
    uiCheck(
      (await expiredSection
        .getByRole("button", { name: "Record late payment for review" })
        .count()) === 1 &&
        (await expiredSection.getByRole("button", { name: "Approve payment" }).count()) === 0,
      "Expired order offers only late-payment recording",
    );
    uiCheck(
      (await awaitingSection.getByText(`Order ${waiting.order.reference}`).count()) === 1,
      "Awaiting-transfer order in its own section",
    );
    const firstActive = activeSection
      .getByRole("listitem")
      .filter({ has: adminPage.getByText("Active · receipt to review") })
      .first();
    const approveButton = firstActive.getByRole("button", { name: "Approve payment" });
    uiCheck(
      await approveButton.isDisabled(),
      "Approve disabled until the Moniepoint credit is confirmed",
    );
    const activeTotal = (await firstActive.innerText()).match(/₦([\d,]+)/)[1].replaceAll(",", "");
    await firstActive.getByLabel("Amount credited (₦)").fill(activeTotal);
    await firstActive.getByLabel("Bank transaction reference").fill("MONIE-UI-1");
    await firstActive.getByLabel(/I have confirmed this exact amount/).check();
    await approveButton.click();
    await adminPage.getByText(/marked paid\./).waitFor({ timeout: 10000 });
    uiCheck(true, "Admin approves from the review screen");
    const axe = await new AxeBuilder({ page: adminPage }).include("#main").analyze();
    const serious = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    uiCheck(
      serious.length === 0,
      `Review screen has no serious a11y issues: ${serious.map((v) => v.id)}`,
    );
    uiCheck(adminErrors.length === 0, `No admin page errors: ${adminErrors}`);
    if (process.env.RECEIPT_SCREENSHOTS)
      await adminPage.screenshot({
        path: `${process.env.RECEIPT_SCREENSHOTS}/payment-review-1440.png`,
        fullPage: true,
      });
    await adminContext.close();
    console.log(`PASS: ${uiChecks} receipt UI assertions`);
  } finally {
    await browser.close();
    await ui.mf.dispose();
  }
}
