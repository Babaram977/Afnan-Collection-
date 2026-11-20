// Application-only authentication: no Cloudflare Access headers, cookies or credential bypasses.
import assert from "node:assert/strict";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";
const EMAIL = "admin@afnancollectionkn.com",
  PASSWORD = "Single login fixture passphrase 2026";
const { mf, db, productId, variantId } = await createTestApp({
  bindings: { ADMIN_AUTH_MODE: "password", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
let checks = 0;
const eq = (a, b, message) => {
  assert.equal(a, b, message);
  checks++;
};
const ok = (v, message) => {
  assert.ok(v, message);
  checks++;
};
const routes = [
  ["/admin-security/status", "GET"],
  ["/admin-security/register/options", "POST"],
  ["/admin/products", "GET"],
  ["/admin/products", "POST"],
  ["/admin/variants", "POST"],
  ["/admin/inventory", "POST"],
  ["/admin/orders", "GET"],
  ["/admin/orders/fixture-order", "PATCH"],
  ["/admin/media/11111111-1111-4111-8111-111111111111.png", "GET"],
  ["/admin/media", "POST"],
  ["/admin/audit", "GET"],
];
const clear = () =>
  db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM auth_cooldowns")]);
async function denied(client, status, label) {
  for (const [path, method] of routes)
    eq(
      (await client.request(path, method, method === "GET" ? undefined : {})).status,
      status,
      `${label} ${method} ${path}`,
    );
}
try {
  const setup = provisionPasswordAdmin({ email: EMAIL });
  for (const sql of setup.statements) await db.prepare(sql).run();
  const guest = new Client(mf);
  eq(
    (await guest.request("/admin-setup", "POST", { token: setup.token, password: PASSWORD }))
      .status,
    200,
    "Existing controlled setup succeeds",
  );
  await denied(guest, 401, "Anonymous");
  const forged = new Client(mf);
  forged.cookies.set("better-auth.session_token", "forged");
  await denied(forged, 401, "Forged session");
  await clear();
  const otp = new Client(mf);
  eq(
    (
      await otp.request("/auth/email-otp/send-verification-otp", "POST", {
        email: EMAIL,
        type: "sign-in",
      })
    ).status,
    200,
    "Local fixture OTP requested",
  );
  const code = await db
    .prepare("SELECT code FROM test_outbox WHERE email=?")
    .bind(EMAIL)
    .first("code");
  eq(
    (
      await otp.request("/auth/sign-in/email-otp", "POST", {
        email: EMAIL,
        otp: code,
        authMethod: "password",
      })
    ).status,
    200,
    "Real OTP login with attempted method spoof",
  );
  const signed = (await otp.request("/me")).body;
  ok(Boolean(signed.userId), "Email OTP establishes a real primary session");
  eq(signed.role, null, "Email OTP cannot substitute for administrator password");
  eq(
    await db
      .prepare("SELECT auth_method FROM session WHERE user_id=?")
      .bind(signed.userId)
      .first("auth_method"),
    "email_otp",
    "OTP method is server-recorded",
  );
  await denied(otp, 403, "OTP-only owner");
  // Neither an input field nor Access-style headers may grant password-authenticated status.
  const spoof = new Client(mf);
  eq(
    (
      await spoof.request("/me", "GET", undefined, {
        "Cf-Access-Authenticated-User-Email": EMAIL,
        "Cf-Access-Jwt-Assertion": "forged",
      })
    ).body.role,
    null,
    "Access headers never grant an application role",
  );
  await clear();
  const owner = new Client(mf);
  const login = await owner.request("/auth/sign-in/email", "POST", {
    email: EMAIL,
    password: PASSWORD,
    authMethod: "email_otp",
  });
  eq(login.status, 200, "One website password login succeeds");
  eq(
    (await owner.request("/me")).body.role,
    "admin",
    "Verified password opens Store Management role",
  );
  const row = await db
    .prepare(
      "SELECT id,auth_method FROM session WHERE user_id=? AND auth_method='password' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(signed.userId)
    .first();
  ok(Boolean(row), "Successful password session recorded independently of client-supplied fields");
  eq(
    (await owner.request("/admin/products")).status,
    200,
    "Product management works without Access",
  );
  eq((await owner.request("/admin/orders")).status, 200, "Order management works without Access");
  const privateKey = "11111111-1111-4111-8111-111111111111.png";
  await (
    await mf.getR2Bucket("MEDIA")
  ).put(privateKey, new Uint8Array([137, 80, 78, 71]), {
    httpMetadata: { contentType: "image/png" },
  });
  eq(
    (await owner.request(`/admin/media/${privateKey}`)).status,
    200,
    "Authorized private photo read works",
  );
  eq(
    (await mf.dispatchFetch(`${ORIGIN}/media/${privateKey}`)).status,
    404,
    "Unpublished media is not public",
  );
  for (const host of [
    "unapproved.example",
    "afnan-collection-production.example.workers.dev",
    "preview.example.workers.dev",
  ]) {
    const url = new URL(ORIGIN);
    url.hostname = host;
    for (const path of ["/admin", "/api/admin/products", "/api/auth/sign-in/email"]) {
      const result = await mf.dispatchFetch(`${url.origin}${path}`, {
        headers: { Cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      });
      eq(result.status, 421, `Alternate hostname denied: ${host}${path}`);
    }
  }
  eq(
    (await mf.dispatchFetch(`${ORIGIN.replace("://", "://www.")}/admin`, { redirect: "manual" }))
      .status,
    301,
    "www is canonical redirect only",
  );
  for (const path of [
    "/admin/products",
    "/admin/variants",
    "/admin/inventory",
    "/admin/orders/fixture-order",
  ]) {
    eq(
      (
        await owner.request(
          path,
          path.includes("orders/") ? "PATCH" : "POST",
          {},
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
      "Cross-origin write denied",
    );
  }
  eq(
    (await owner.request("/admin/products", "POST", {}, { "Sec-Fetch-Site": "cross-site" })).status,
    403,
    "Cross-site fetch metadata denied",
  );
  await db.prepare("UPDATE session SET auth_method='legacy' WHERE id=?").bind(row.id).run();
  eq(
    (await owner.request("/me")).body.role,
    null,
    "Existing unclassified sessions cannot inherit password permissions",
  );
  await denied(owner, 403, "Legacy session");
  await clear();
  eq(
    (await owner.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD }))
      .status,
    200,
    "Fresh password reauthentication restores access",
  );
  eq((await owner.request("/admin/products")).status, 200, "Fresh verified session authorized");
  eq((await owner.request("/auth/sign-out", "POST", {})).status, 200, "Logout succeeds");
  eq((await owner.request("/admin/products")).status, 401, "Logout invalidates privilege");
  await clear();
  const wrong = await guest.request("/auth/sign-in/email", "POST", {
    email: EMAIL,
    password: "incorrect fixture passphrase",
  });
  eq(wrong.status, 401, "Wrong password refused");
  const events = (
    await db
      .prepare("SELECT actor,action,entity_id,detail FROM audit WHERE action LIKE 'auth.%'")
      .all()
  ).results;
  ok(
    events.some(
      (x) => x.action === "auth.session.created" && JSON.parse(x.detail).method === "password",
    ),
    "Password sign-in audited",
  );
  ok(
    events.some((x) => x.action === "auth.session.ended"),
    "Logout audited",
  );
  ok(
    events.some((x) => x.action === "auth.password.failed"),
    "Failed password authentication audited",
  );
  const serialized = JSON.stringify(events);
  ok(
    !serialized.includes(PASSWORD) && !serialized.includes(setup.token),
    "Audit contains no password or setup credential",
  );
  for (const value of owner.cookies.values())
    if (value) ok(!serialized.includes(value), "Audit contains no session token");
  eq(
    (await db.prepare("PRAGMA quick_check").first()).quick_check,
    "ok",
    "Session migration integrity passes",
  );
  eq((await db.prepare("PRAGMA foreign_key_check").all()).results.length, 0, "Foreign keys intact");
  eq(
    await db.prepare("SELECT stock FROM variants WHERE id=?").bind(variantId).first("stock"),
    5,
    "Denied stock writes preserve fixture inventory",
  );
  eq(
    await db.prepare("SELECT count(*) AS n FROM products WHERE id=?").bind(productId).first("n"),
    1,
    "Existing product preserved",
  );
  const health = (await guest.request("/health")).body;
  ok(!health.checkoutEnabled && !health.paymentsEnabled, "Checkout and payments remain disabled");
  console.log(
    `PASS: ${checks} independent password-session, authorization, host, CSRF, audit and migration checks`,
  );
} finally {
  await mf.dispose();
}

// Same independent login under a production-style HTTPS origin, with no real network/mail calls.
const secure = await createTestApp({
  bindings: {
    APP_ENV: "production",
    APP_ORIGIN: "https://localhost",
    ADMIN_AUTH_MODE: "password",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
  },
});
try {
  const provision = provisionPasswordAdmin({ email: EMAIL });
  for (const sql of provision.statements) await secure.db.prepare(sql).run();
  const owner = new Client(secure.mf, "https://localhost");
  eq(
    (await owner.request("/admin-setup", "POST", { token: provision.token, password: PASSWORD }))
      .status,
    200,
    "HTTPS controlled setup",
  );
  const login = await owner.request("/auth/sign-in/email", "POST", {
    email: EMAIL,
    password: PASSWORD,
  });
  eq(login.status, 200, "HTTPS production-style password login");
  const cookie = login.headers.getSetCookie().find((c) => c.includes("session_token"));
  ok(
    Boolean(cookie) &&
      /;\s*Secure/i.test(cookie) &&
      /;\s*HttpOnly/i.test(cookie) &&
      /SameSite=Lax/i.test(cookie) &&
      !/;\s*Domain=/i.test(cookie),
    "Secure, HttpOnly, SameSite, host-only password session cookie",
  );
  eq(
    (await owner.request("/admin/products")).status,
    200,
    "Production-style role without Cloudflare Access",
  );
  const redirected = await secure.mf.dispatchFetch("http://localhost/api/auth/sign-in/email", {
    method: "POST",
    redirect: "manual",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  eq(redirected.status, 308, "HTTP request redirected before authentication");
  eq(
    redirected.headers.get("location"),
    "https://localhost/api/auth/sign-in/email",
    "HTTPS canonical target",
  );
  await secure.db.prepare("UPDATE session SET expires_at=1").run();
  eq((await owner.request("/admin/products")).status, 401, "Expired password session denied");
  console.log(
    `PASS: ${checks} total single-login checks including HTTPS, expiry and production-mode authorization`,
  );
} finally {
  await secure.mf.dispose();
}
