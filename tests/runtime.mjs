import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createTestApp, Client, AUTH_SECRET, ORIGIN } from "./harness.mjs";
const { mf, db, productId, variantId, zoneId } = await createTestApp();
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  const guest = new Client(mf);
  await guest.request("/me");
  check((await guest.request("/health")).status === 200, "Database health");
  check(
    (await guest.request("/products")).body[0].variants[0].priceKobo === 250000,
    "Persisted catalog",
  );
  check((await guest.request("/admin/products")).status === 401, "Anonymous admin rejected");
  check(
    (await guest.request("/orders", "POST", {}, { Origin: "https://evil.example" })).status === 403,
    "CSRF rejected",
  );
  check(
    (await guest.request("/orders", "POST", { lines: [] })).status === 400,
    "Empty cart rejected",
  );
  const makeOrder = (qty = 1) => ({
    lines: [{ variantId, qty }],
    zoneId,
    idempotencyKey: randomUUID(),
    customer: { name: "Fixture buyer", email: "guest@example.com", phone: "08012345678" },
    address: { street: "Fixture street 10", city: "Kano", state: "Kano" },
  });
  const input = makeOrder(1);
  const order = await guest.request("/orders", "POST", input);
  check(order.status === 201, `Order created: ${JSON.stringify(order)}`);
  check(order.body.total_kobo === 300000, "Server computes authoritative total and delivery");
  check(
    (await guest.request("/orders", "POST", input)).body.id === order.body.id,
    "Order retry idempotent",
  );
  check(
    (await guest.request("/orders", "POST", { ...input, lines: [{ variantId, qty: 2 }] }))
      .status === 409,
    "Changed idempotent payload rejected",
  );
  const stranger = new Client(mf);
  await stranger.request("/me");
  check(
    (await stranger.request(`/orders/${order.body.id}`)).status === 404,
    "Guest order ownership",
  );
  await guest.request(`/orders/${order.body.id}/cancel`, "POST", {});
  await guest.request(`/orders/${order.body.id}/cancel`, "POST", {});
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock === 5,
    "Cancel restores stock once",
  );
  await db.prepare("UPDATE variants SET stock=1 WHERE id=?").bind(variantId).run();
  const requests = await Promise.all([
    guest.request("/orders", "POST", makeOrder()),
    stranger.request("/orders", "POST", makeOrder()),
  ]);
  check(
    requests.filter((r) => r.status === 201).length === 1,
    "Only one concurrent order for last stock",
  );
  check(requests.filter((r) => r.status === 409).length === 1, "Oversell rejected");
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock === 0,
    "Stock nonnegative",
  );
  const winner = requests.find((r) => r.status === 201).body;
  await db.prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?").bind(winner.id).run();
  await guest.request("/products");
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock === 1,
    "Expiry restores reservation",
  );
  const customer = new Client(mf);
  const me = await customer.signIn(db);
  check(Boolean(me.userId), "Email OTP creates session");
  check((await customer.request("/admin/products")).status === 403, "Customer cannot administer");
  const wrong = await customer.request("/auth/sign-in/email-otp", "POST", {
    email: "fixture@example.com",
    otp: "000000",
  });
  check(wrong.status !== 200, "Invalid or reused code rejected");
  const staff = new Client(mf);
  const admin = await staff.signIn(db, "admin@example.com");
  await db.prepare("INSERT INTO staff(user_id,role) VALUES(?,'admin')").bind(admin.userId).run();
  check((await staff.request("/admin/products")).status === 200, "Verified staff authorized");
  const adjustment = await staff.request("/admin/inventory", "POST", {
    variantId,
    delta: -100,
    reason: "Fixture overshoot",
  });
  check(adjustment.status !== 200, "Negative stock adjustment rejected");
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock === 1,
    "Failed adjustment rolled back",
  );
  const address = await customer.request("/addresses", "POST", {
    label: "Test",
    address: { street: "Fixture street 10", city: "Kano", state: "Kano" },
  });
  check(address.status === 201, "Address persists");
  check((await staff.request("/addresses")).body.length === 0, "Private addresses isolated");
  const paid = await guest.request("/orders", "POST", makeOrder());
  check(paid.status === 201, "Payment order prepared");
  check(
    (await guest.request(`/orders/${paid.body.id}/pay`, "POST", {})).status === 200,
    "Fixture initialization",
  );
  const event = JSON.stringify({ event: "charge.success", data: { reference: paid.body.id } });
  const signature = createHmac("sha512", AUTH_SECRET).update(event).digest("hex");
  check(
    (await guest.request("/payments/webhook", "POST", event, { "x-paystack-signature": "bad" }))
      .status === 401,
    "Forged webhook rejected",
  );
  check(
    (await guest.request("/payments/webhook", "POST", event, { "x-paystack-signature": signature }))
      .status === 200,
    "Signed webhook verified",
  );
  check(
    (await guest.request("/payments/webhook", "POST", event, { "x-paystack-signature": signature }))
      .status === 200,
    "Duplicate webhook accepted idempotently",
  );
  check(
    (await db.prepare("SELECT COUNT(*) AS n FROM payment_events").first()).n === 1,
    "One payment event recorded",
  );
  check(
    (await guest.request(`/orders/${paid.body.id}`)).body.status === "paid",
    "Verified payment marks order paid",
  );
  await guest.request(`/orders/${paid.body.id}/cancel`, "POST", {});
  check(
    (await guest.request(`/orders/${paid.body.id}`)).body.status === "paid",
    "Paid order cannot be cancelled as unpaid",
  );
  const fulfil = new Client(mf);
  const f = await fulfil.signIn(db, "fulfilment@example.com");
  await db.prepare("INSERT INTO staff(user_id,role) VALUES(?,'fulfilment')").bind(f.userId).run();
  check(
    (await fulfil.request("/admin/customers")).status === 403,
    "Fulfilment role cannot read customer directory",
  );
  check(
    (await fulfil.request(`/admin/orders/${paid.body.id}`, "PATCH", { status: "shipped" }))
      .status === 409,
    "Cannot skip fulfilment transitions",
  );
  check(
    (await fulfil.request(`/admin/orders/${paid.body.id}`, "PATCH", { status: "processing" }))
      .status === 200,
    "Staff fulfilment works",
  );

  const consumed = (
    await db.prepare("SELECT code FROM test_outbox WHERE email='fixture@example.com'").first()
  ).code;
  check(
    (
      await customer.request("/auth/sign-in/email-otp", "POST", {
        email: "fixture@example.com",
        otp: consumed,
      })
    ).status !== 200,
    "Consumed OTP cannot be replayed",
  );
  check(
    (
      await staff.request("/admin/categories", "POST", {
        slug: "fixture-category",
        label: "Fixture category",
      })
    ).status === 200,
    "Categories persist",
  );
  const draft = await staff.request("/admin/products", "POST", {
    slug: "hidden-draft",
    name: "Draft fixture",
    category: "fixture-category",
    ageGroups: [],
    images: [],
    status: "draft",
  });
  check(draft.status === 200, "Product created through staff API");
  check(
    !(await guest.request("/products")).body.some((p) => p.slug === "hidden-draft"),
    "Draft product not published",
  );
  const variant = await staff.request("/admin/variants", "POST", {
    productId: draft.body.id,
    sku: "DRAFT-001",
    priceKobo: 100000,
  });
  check(variant.status === 200, "SKU persisted");
  check(
    (
      await staff.request("/admin/variants", "POST", {
        productId: draft.body.id,
        sku: "DRAFT-001",
        priceKobo: 100000,
      })
    ).status !== 200,
    "Duplicate SKU rejected",
  );
  check(
    (
      await staff.request("/admin/content", "POST", {
        key: "delivery",
        value: "Fixture policy text",
      })
    ).status === 200,
    "Approved content configurable",
  );
  check(
    (await guest.request("/store")).body.content.some((c) => c.value === "Fixture policy text"),
    "Configured content publicly available",
  );
  check(
    (await guest.request("/admin/products", "POST", { status: "active" })).status === 401,
    "Anonymous writes denied",
  );
  check(
    (
      await fulfil.request("/admin/inventory", "POST", {
        variantId,
        delta: 1,
        reason: "Not permitted",
      })
    ).status === 403,
    "Fulfilment role cannot adjust stock",
  );
  check(
    (await staff.request("/admin/payments/" + paid.body.id + "/refund", "POST", { confirm: true }))
      .body.status === "refund_pending",
    "Refund durably initiated",
  );
  check(
    (await staff.request("/admin/payments/" + paid.body.id + "/refund", "POST", { confirm: true }))
      .body.status === "refunded",
    "Refund status verified",
  );
  check(
    (await staff.request("/admin/payments/" + paid.body.id + "/refund", "POST", { confirm: true }))
      .body.status === "refunded",
    "Refund request replay idempotent",
  );
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock === 0,
    "Refund does not restock uninspected goods",
  );
  check(
    (await guest.request("/payments/webhook", "POST", event, { "x-paystack-signature": signature }))
      .status === 200,
    "Payment callback replay after refund acknowledged",
  );
  check(
    (await guest.request("/orders/" + paid.body.id)).body.status === "refunded",
    "Callback cannot reverse refund",
  );
  await staff.request("/admin/inventory", "POST", {
    variantId,
    delta: 5,
    reason: "Fixture replenishment",
  });
  const mismatch = await guest.request("/orders", "POST", makeOrder());
  await guest.request("/orders/" + mismatch.body.id + "/pay", "POST", {});
  await db
    .prepare("UPDATE test_provider_transactions SET amount=amount-1 WHERE reference=?")
    .bind(mismatch.body.id)
    .run();
  const mismatchEvent = JSON.stringify({
    event: "charge.success",
    data: { reference: mismatch.body.id },
  });
  const mismatchSignature = createHmac("sha512", AUTH_SECRET).update(mismatchEvent).digest("hex");
  check(
    (
      await guest.request("/payments/webhook", "POST", mismatchEvent, {
        "x-paystack-signature": mismatchSignature,
      })
    ).status === 409,
    "Provider amount mismatch rejected",
  );
  check(
    (await guest.request("/orders/" + mismatch.body.id)).body.status === "pending",
    "Mismatched payment cannot mark order paid",
  );
  await db
    .prepare("UPDATE test_provider_transactions SET amount=amount+1 WHERE reference=?")
    .bind(mismatch.body.id)
    .run();
  await db
    .prepare("UPDATE orders SET expires_at=unixepoch()-1 WHERE id=?")
    .bind(mismatch.body.id)
    .run();
  check(
    (
      await guest.request("/payments/webhook", "POST", mismatchEvent, {
        "x-paystack-signature": mismatchSignature,
      })
    ).status === 200,
    "Late payment recorded",
  );
  check(
    (
      await db
        .prepare("SELECT status FROM payments WHERE reference=?")
        .bind(mismatch.body.id)
        .first()
    ).status === "review",
    "Late payment requires review and cannot reclaim sold stock",
  );
  check(
    (await guest.request("/orders/" + mismatch.body.id)).body.status === "expired",
    "Expired order stays expired on late payment",
  );
  const before = (await db.prepare("SELECT COUNT(*) AS n FROM orders").first()).n;
  check(
    (await guest.request("/orders", "POST", makeOrder(99))).status === 409,
    "Insufficient order rolled back",
  );
  check(
    (await db.prepare("SELECT COUNT(*) AS n FROM orders").first()).n === before,
    "No partial order remains after rollback",
  );
  await staff.request("/admin/customers/" + me.userId + "/revoke", "POST", {});
  check(
    (await customer.request("/addresses")).status === 401,
    "Revoked sessions lose private access",
  );
  check(
    (await staff.request("/admin/audit")).body.length > 0,
    "Administrative audit records persist",
  );
  // Clear the per-minute API bucket before independent SSR assertions. This is
  // direct fixture setup; the production rate-limit implementation stays active.
  await db.prepare("DELETE FROM rate_limits").run();

  check(
    (
      await staff.request("/admin/media", "POST", "<svg><script>alert(1)</script></svg>", {
        "Content-Type": "image/svg+xml",
      })
    ).status === 400,
    "SVG/HTML upload rejected",
  );
  check(
    (
      await staff.request("/admin/media", "POST", "x".repeat(5 * 1024 * 1024 + 1), {
        "Content-Type": "image/png",
      })
    ).status === 413,
    "Oversized upload rejected",
  );
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZOKAAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await staff.request("/admin/media", "POST", image, {
    "Content-Type": "image/png",
  });
  check(upload.status === 201, "Authenticated image upload stored in local R2");
  check(
    (await mf.dispatchFetch(ORIGIN + upload.body.url)).status === 404,
    "Unpublished image not exposed",
  );
  await db
    .prepare("UPDATE products SET images=? WHERE id=?")
    .bind(JSON.stringify([{ url: upload.body.url, alt: "Fixture image" }]), productId)
    .run();
  const visibleImage = await mf.dispatchFetch(ORIGIN + upload.body.url);
  check(
    visibleImage.status === 200 && visibleImage.headers.get("Content-Type") === "image/png",
    "Published media served with fixed content type",
  );
  check(
    (await guest.request("/orders", "POST", "x".repeat(65537))).status === 413,
    "Oversized JSON body bounded",
  );
  const zeroVariant = await staff.request("/admin/variants", "POST", {
    productId,
    sku: "NO-STOCK-FIXTURE",
    priceKobo: 100000,
  });
  const stockBefore = (
    await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()
  ).stock;
  const multi = makeOrder();
  multi.lines.push({ variantId: zeroVariant.body.id, qty: 1 });
  check(
    (await guest.request("/orders", "POST", multi)).status === 409,
    "Multi-item order rejects unavailable second item",
  );
  check(
    (await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first()).stock ===
      stockBefore,
    "First item reservation rolled back with second item failure",
  );
  const brute = new Client(mf);
  let limited = false;
  for (let n = 0; n < 16; n++) {
    const response = await brute.request("/auth/sign-in/email-otp", "POST", {
      email: "unknown@example.com",
      otp: "123456",
    });
    if (response.status === 429) {
      limited = true;
      break;
    }
  }
  check(limited, "OTP abuse rate limited");

  check(
    (
      await staff.request("/admin/variants", "POST", {
        id: variantId,
        productId,
        sku: "FIXTURE-001",
        size: "M",
        priceKobo: 250000,
        salePriceKobo: 200000,
      })
    ).status === 200,
    "Promotional price configured",
  );
  const sale = (await guest.request("/products")).body
    .find((p) => p.id === productId)
    .variants.find((v) => v.id === variantId);
  check(
    sale.priceKobo === 200000 && sale.regularPriceKobo === 250000,
    "Storefront exposes genuine configured promotional price",
  );
  check(
    (
      await staff.request("/admin/variants", "POST", {
        id: variantId,
        productId,
        sku: "FIXTURE-001",
        priceKobo: 250000,
        salePriceKobo: 300000,
      })
    ).status === 400,
    "Invalid promotional price rejected",
  );
  const saleOrder = await guest.request("/orders", "POST", makeOrder());
  check(
    saleOrder.body.total_kobo === 250000,
    "Checkout and stock trigger use authoritative promotional amount",
  );
  await guest.request("/orders/" + saleOrder.body.id + "/cancel", "POST", {});
  const contacts = {
    address: "Fixture business address in Kano",
    whatsapp: "+2347035963225",
    instagram: "https://www.instagram.com/afnan_collectionkn",
    tiktok: "https://www.tiktok.com/@afnan_collectionkn",
  };
  check(
    (await staff.request("/admin/business", "POST", contacts)).status === 200,
    "Business contacts configurable by staff",
  );
  check(
    (await guest.request("/business")).body.address === contacts.address,
    "Public business configuration resolves saved contacts",
  );
  check(
    (await guest.request("/admin/business", "POST", contacts)).status === 401,
    "Anonymous contact changes rejected",
  );
  check(
    (
      await staff.request("/admin/business", "POST", {
        ...contacts,
        instagram: "javascript:alert(1)",
      })
    ).status === 400,
    "Unsafe social link rejected",
  );
  const ssr = await mf.dispatchFetch(`${ORIGIN}/shop`);
  const html = await ssr.text();
  check(
    ssr.status === 200 && html.includes("Test fixture romper"),
    `SSR renders persisted catalog: ${ssr.status} ${html.slice(-250)}`,
  );
  const missing = await mf.dispatchFetch(`${ORIGIN}/product/missing`);
  check(missing.status === 404, "Unknown product 404");

  const staffDetail = await fulfil.request("/admin/orders/" + paid.body.id);
  check(
    staffDetail.status === 200 && staffDetail.body.items.length > 0,
    "Fulfilment staff can read purchased items and delivery",
  );
  check(
    (await staff.request("/admin/products/" + productId, "DELETE")).status === 200,
    "Product safely deleted",
  );
  check(
    !(await guest.request("/products")).body.some((p) => p.id === productId),
    "Deleted product hidden from storefront",
  );
  check(
    (await guest.request("/orders/" + paid.body.id)).body.items[0].sku === "FIXTURE-001",
    "Historical order items survive product deletion",
  );

  const closed = await createTestApp({
    bindings: { CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
  });
  try {
    const client = new Client(closed.mf);
    await client.request("/me");
    const health = await client.request("/health");
    check(
      !health.body.checkoutEnabled && !health.body.paymentsEnabled,
      "Default operational gates disabled",
    );
    check(
      (await client.request("/orders", "POST", makeOrder())).status === 503,
      "Disabled checkout rejects order preparation",
    );
    check(
      (await client.request("/payments/webhook", "POST", "{}")).status === 503,
      "Disabled payments reject webhooks",
    );
  } finally {
    await closed.mf.dispose();
  }
  console.log(
    `PASS: ${checks} Worker/D1/auth/commerce/security assertions (controlled fixtures only)`,
  );
} finally {
  await mf.dispose();
}
