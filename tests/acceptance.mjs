import assert from "node:assert/strict";
import { createTestApp, Client } from "./harness.mjs";
// Local simulation of remote acceptance settings: fixture flag must not bypass APP_ENV.
const { mf, db, variantId, zoneId } = await createTestApp({
  bindings: {
    APP_ENV: "acceptance",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
    TEST_FIXTURES: "true",
  },
});
try {
  const guest = new Client(mf);
  assert.equal(
    (
      await guest.request("/auth/sign-up/email", "POST", {
        email: "uninvited@example.com",
        password: "not-a-real-password-1234",
        name: "Uninvited",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await guest.request("/auth/email-otp/send-verification-otp", "POST", {
        email: "uninvited@example.com",
        type: "sign-in",
      })
    ).status,
    200,
    "Unknown identity receives a non-enumerating response, never a signup code",
  );
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM test_outbox").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM user").first("n"), 0);
  assert.notEqual(
    (
      await guest.request("/auth/sign-in/email-otp", "POST", {
        email: "uninvited@example.com",
        otp: "123456",
      })
    ).status,
    200,
  );
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM user").first("n"), 0);
  assert.equal((await guest.request("/admin/products")).status, 401);
  assert.equal(
    (
      await guest.request("/admin/products", "GET", undefined, {
        "Cf-Access-Authenticated-User-Email": "admin@afnancollectionkn.com",
        "Cf-Access-Jwt-Assertion": "forged-not-a-valid-token",
        Cookie: "CF_Authorization=forged-not-a-valid-token",
      })
    ).status,
    401,
    "Access identity headers/cookie cannot create an application admin session",
  );
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM staff").first("n"), 0);
  const order = await guest.request("/orders", "POST", {
    lines: [{ variantId, qty: 1 }],
    zoneId,
    idempotencyKey: "acceptance-disabled-checkout",
    customer: { name: "Test", email: "uninvited@example.com", phone: "08012345678" },
    address: { street: "Test street", city: "Kano", state: "Kano" },
  });
  assert.equal(order.status, 503);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM orders").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM payments").first("n"), 0);
  console.log("PASS: 12 acceptance registration, fixture-isolation, admin and checkout assertions");
} finally {
  await mf.dispose();
}
