// Administrator email-code regression (2026-11-16 incident): with sign-up disabled, a code request
// for an address with no account is acknowledged without generating or sending a code. That is the
// intended non-enumerating behaviour; these checks pin it down, prove a provisioned administrator
// does reach the provider, and prove provider failures stay generic to the client but visible to
// operators. Resend is stubbed: no real email is sent.
import assert from "node:assert/strict";
import { createTestApp, Client } from "./harness.mjs";
import { bootstrapSQL } from "../scripts/admin-bootstrap-plan.mjs";

const OWNER = "admin@afnancollectionkn.com";
const SENDER = {
  APP_ENV: "acceptance",
  CHECKOUT_ENABLED: "false",
  PAYMENT_MODE: "disabled",
  RESEND_API_KEY: "re_stub_for_tests_only",
  EMAIL_FROM: "noreply@afnancollectionkn.com",
  EMAIL_SENDER_VERIFIED: "true",
};

// Capture Worker console output (Miniflare forwards it to this process's stdout/stderr).
const logs = [];
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => {
    logs.push(String(chunk));
    return write(chunk, ...rest);
  };
}
const logged = (event) => logs.some((line) => line.includes(`"event":"${event}"`));
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

async function app(status) {
  const calls = [];
  const instance = await createTestApp({
    bindings: SENDER,
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.hostname === "api.resend.com") {
        calls.push({ url: request.url, body: await request.json() });
        return new Response(JSON.stringify({ id: "stub" }), { status });
      }
      return new Response("blocked in tests", { status: 599 });
    },
  });
  return { ...instance, calls };
}
async function provision(db) {
  for (const statement of bootstrapSQL({
    email: OWNER,
    approval: "test-approval-ref",
    operator: "test-operator",
  })
    .split(";\n")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
}
const request = (client, email) =>
  client.request("/auth/email-otp/send-verification-otp", "POST", { email, type: "sign-in" });
let checks = 0;

// 1-2. No account (the live state on 2026-11-16) vs a provisioned administrator.
{
  const { mf, db, calls } = await app(200);
  try {
    const client = new Client(mf);
    const unknown = await request(client, OWNER);
    assert.equal(unknown.status, 200, "Unprovisioned address gets the generic acknowledgement");
    assert.deepEqual(unknown.body, { success: true });
    await settle();
    assert.equal(calls.length, 0, "No account: the provider is never called");
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM verification").first("n"), 0);
    assert.ok(logged("auth.otp.no_account"), "Operators can see the no-account case");
    checks += 5;

    await provision(db);
    assert.equal(
      await db.prepare("SELECT state FROM admin_security").first("state"),
      "pending",
      "Bootstrap creates a pending administrator only",
    );
    await db.prepare("DELETE FROM auth_cooldowns").run();
    await db.prepare("DELETE FROM rate_limits").run();
    const known = await request(client, OWNER);
    assert.equal(known.status, 200);
    assert.deepEqual(known.body, { success: true }, "Same response as the unknown case");
    await settle();
    assert.equal(calls.length, 1, "Provisioned administrator: exactly one provider request");
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal(calls[0].body.from, "noreply@afnancollectionkn.com");
    assert.deepEqual([calls[0].body.to].flat(), [OWNER]);
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM verification").first("n"), 1);
    assert.ok(logged("auth.email.accepted"), "Operators can see provider acceptance");
    const code = calls[0].body.text.match(/\b(\d{6})\b/)?.[1];
    assert.ok(code, "The email carries a 6-digit code");
    assert.ok(!logs.some((line) => line.includes(code)), "The code never appears in logs");
    assert.ok(!logs.some((line) => line.includes(OWNER)), "The address never appears in logs");
    checks += 12;

    const wrong = await client.request("/auth/sign-in/email-otp", "POST", {
      email: OWNER,
      otp: code === "000000" ? "111111" : "000000",
    });
    assert.equal(wrong.status, 400, "A wrong code is refused generically");
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM user").first("n"), 1);
    checks += 2;
  } finally {
    await mf.dispose();
  }
}

// 3. Provider rejects the request (bad key, unverified domain, quota): generic to the client,
// visible to operators with the status code only.
{
  const { mf, db, calls } = await app(403);
  try {
    await provision(db);
    const response = await request(new Client(mf), OWNER);
    assert.equal(response.status, 200, "Provider failure does not reveal the account");
    assert.deepEqual(response.body, { success: true });
    await settle();
    assert.equal(calls.length, 1);
    assert.ok(
      logs.some((line) => line.includes('"event":"auth.email.provider_rejected","status":403')),
      "Operators see the provider status",
    );
    assert.ok(logged("auth.email.unavailable"));
    const code = calls[0].body.text.match(/\b(\d{6})\b/)?.[1];
    assert.ok(code && !logs.some((line) => line.includes(code)), "Code absent from logs");
    checks += 6;
  } finally {
    await mf.dispose();
  }
}

console.log(
  `PASS: ${checks} administrator email-code assertions (no account, provisioned, provider rejection; Resend stubbed)`,
);
