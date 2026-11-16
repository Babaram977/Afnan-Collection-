// Password-mode administrator authentication (ADMIN_AUTH_MODE=password, owner decision 2026-11-16).
// Covers provisioning, one-time setup, hashing, sign-in, authorization, revocation, rate limits,
// log hygiene, and that the default (WebAuthn) mode does not expose password sign-in at all.
import assert from "node:assert/strict";
import { createTestApp, Client } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const OWNER = "admin@afnancollectionkn.com";
const PASSWORD = "correct horse battery staple 42";
const BASE = { APP_ENV: "acceptance", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" };
const logs = [];
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => {
    logs.push(String(chunk));
    return write(chunk, ...rest);
  };
}
let checks = 0;
const ok = (...args) => {
  assert.ok(...args);
  checks++;
};
const eq = (...args) => {
  assert.equal(...args);
  checks++;
};
async function provision(db, email, options = {}) {
  const { statements, token } = provisionPasswordAdmin({ email, ...options });
  for (const sql of statements) await db.prepare(sql).run();
  return token;
}
const clear = (db) =>
  db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM auth_cooldowns")]);

// Default mode: password sign-in and setup do not exist.
{
  const { mf } = await createTestApp({ bindings: BASE });
  try {
    const guest = new Client(mf);
    eq(
      (await guest.request("/auth/sign-in/email", "POST", { email: OWNER, password: PASSWORD }))
        .status,
      404,
      "Default mode has no password sign-in",
    );
    ok(
      (await guest.request("/admin-setup", "POST", { token: "0".repeat(64), password: PASSWORD }))
        .status >= 400,
    );
    eq((await guest.request("/me")).body.adminAuth, "webauthn");
  } finally {
    await mf.dispose();
  }
}

const { mf, db } = await createTestApp({ bindings: { ...BASE, ADMIN_AUTH_MODE: "password" } });
try {
  const guest = new Client(mf);
  eq((await guest.request("/me")).body.adminAuth, "password");
  eq(
    (
      await guest.request("/auth/sign-up/email", "POST", {
        email: "x@example.com",
        password: PASSWORD,
        name: "X",
      })
    ).status,
    404,
    "Public registration stays disabled",
  );
  eq(await db.prepare("SELECT COUNT(*) AS n FROM user").first("n"), 0);

  // Provisioning: user + staff + hashed one-time token; no plaintext token stored.
  const token = await provision(db, OWNER);
  eq(await db.prepare("SELECT role FROM staff").first("role"), "admin");
  const stored = await db.prepare("SELECT identifier,value FROM verification").all();
  eq(stored.results.length, 1);
  ok(!JSON.stringify(stored.results).includes(token), "Setup token stored only as a digest");
  eq((await guest.request("/admin/products")).status, 401, "No session: 401");

  // Setup: wrong token, weak password, valid, reuse.
  eq(
    (await guest.request("/admin-setup", "POST", { token: "a".repeat(64), password: PASSWORD }))
      .status,
    400,
  );
  eq(
    (await guest.request("/admin-setup", "POST", { token, password: "short" })).status,
    400,
    "Weak password refused",
  );
  eq(
    await db.prepare("SELECT COUNT(*) AS n FROM verification").first("n"),
    1,
    "Failed attempts keep the token",
  );
  eq(
    (await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status,
    200,
    "Setup succeeds",
  );
  eq(
    (await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status,
    400,
    "Token is single-use",
  );
  const hash = await db
    .prepare("SELECT password FROM account WHERE provider_id='credential'")
    .first("password");
  ok(
    hash && !hash.includes(PASSWORD) && /^[a-f0-9]+:[a-f0-9]+$/.test(hash),
    "scrypt salt:key hash, never plaintext",
  );
  eq(await db.prepare("SELECT email_verified FROM user").first("email_verified"), 1);

  // Expired token.
  const expired = await provision(db, "late@example.com", { now: Date.now() - 31 * 60_000 });
  eq(
    (await guest.request("/admin-setup", "POST", { token: expired, password: PASSWORD })).status,
    400,
    "Expired token refused",
  );

  // Sign-in: unknown email and wrong password get the same generic answer.
  await clear(db);
  const unknown = await guest.request("/auth/sign-in/email", "POST", {
    email: "nobody@example.com",
    password: PASSWORD,
  });
  const wrong = await guest.request("/auth/sign-in/email", "POST", {
    email: OWNER,
    password: "wrong password 123",
  });
  eq(unknown.status, 401);
  eq(wrong.status, 401);
  assert.deepEqual(unknown.body, wrong.body, "No account enumeration");
  checks++;

  await clear(db);
  const owner = new Client(mf);
  eq(
    (await owner.request("/auth/sign-in/email", "POST", { email: OWNER, password: PASSWORD }))
      .status,
    200,
    "Owner signs in",
  );
  eq((await owner.request("/me")).body.role, "admin");
  eq((await owner.request("/admin/products")).status, 200, "Admin route with password session");
  eq((await owner.request("/admin/overview")).status, 200);

  // A signed-in account without a staff role is refused.
  const staffless = await provision(db, "helper@example.com");
  await db
    .prepare(
      "DELETE FROM staff WHERE user_id=(SELECT id FROM user WHERE email='helper@example.com')",
    )
    .run();
  // Setup requires a staff row, so the token no longer works either.
  eq(
    (await guest.request("/admin-setup", "POST", { token: staffless, password: PASSWORD })).status,
    400,
    "Setup requires staff role",
  );

  // Revocation: removing the staff row ends the session entirely (trigger staff_security_removal).
  await db
    .prepare("DELETE FROM staff WHERE user_id=(SELECT id FROM user WHERE email=?)")
    .bind(OWNER)
    .run();
  eq((await owner.request("/admin/products")).status, 401, "Staff removal ends the session");
  eq((await owner.request("/me")).body.userId, null);
  await db
    .prepare("INSERT INTO staff(user_id,role) SELECT id,'admin' FROM user WHERE email=?")
    .bind(OWNER)
    .run();
  await clear(db);
  eq(
    (await owner.request("/auth/sign-in/email", "POST", { email: OWNER, password: PASSWORD }))
      .status,
    200,
  );
  eq((await owner.request("/admin/products")).status, 200, "Restored role works after sign-in");

  // A signed-in account with a password but no staff role is refused (403).
  const helperToken = await provision(db, "helper2@example.com");
  eq(
    (await guest.request("/admin-setup", "POST", { token: helperToken, password: PASSWORD }))
      .status,
    200,
  );
  await db
    .prepare(
      "DELETE FROM staff WHERE user_id=(SELECT id FROM user WHERE email='helper2@example.com')",
    )
    .run();
  await clear(db);
  const helper = new Client(mf);
  eq(
    (
      await helper.request("/auth/sign-in/email", "POST", {
        email: "helper2@example.com",
        password: PASSWORD,
      })
    ).status,
    200,
  );
  eq((await helper.request("/admin/products")).status, 403, "Authenticated non-staff: 403");
  eq((await helper.request("/me")).body.role, null);

  // A disabled security state blocks access even with a valid session.
  await db
    .prepare(
      "INSERT INTO admin_security(user_id,state,approval_ref,verified_by) SELECT id,'disabled','t','t' FROM user WHERE email=?",
    )
    .bind(OWNER)
    .run();
  eq((await owner.request("/admin/products")).status, 403, "Disabled state blocks");
  await db.prepare("DELETE FROM admin_security").run();

  // Sign-out ends the session.
  eq((await owner.request("/auth/sign-out", "POST", {})).status, 200);
  eq((await owner.request("/admin/products")).status, 401, "Signed out: 401");

  // Brute force: per-email limit.
  await clear(db);
  let last;
  for (let i = 0; i < 7; i++) {
    last = await new Client(mf).request("/auth/sign-in/email", "POST", {
      email: OWNER,
      password: `guess-number-${i}-xx`,
    });
  }
  eq(last.status, 429, "Per-email password attempt limit");

  // Cross-origin sign-in is refused.
  await clear(db);
  eq(
    (
      await guest.request(
        "/auth/sign-in/email",
        "POST",
        { email: OWNER, password: PASSWORD },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
    "Cross-origin sign-in refused",
  );

  ok(!logs.some((l) => l.includes(PASSWORD)), "Password never logged");
  ok(!logs.some((l) => l.includes(token)), "Setup token never logged");
} finally {
  await mf.dispose();
}

// The production combination (APP_ENV=production + password mode): setup, sign-in, admin access,
// sign-up still refused, wrong password generic, non-session refused.
{
  const prod = await createTestApp({
    bindings: {
      APP_ENV: "production",
      CHECKOUT_ENABLED: "false",
      PAYMENT_MODE: "disabled",
      ADMIN_AUTH_MODE: "password",
    },
  });
  try {
    const guest = new Client(prod.mf);
    eq((await guest.request("/me")).body.adminAuth, "password", "Production reports password mode");
    eq(
      (
        await guest.request("/auth/sign-up/email", "POST", {
          email: "x@example.com",
          password: PASSWORD,
          name: "X",
        })
      ).status,
      404,
      "Production sign-up refused",
    );
    const token = await provision(prod.db, OWNER);
    eq((await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status, 200);
    eq((await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status, 400);
    eq(
      (
        await guest.request("/auth/sign-in/email", "POST", {
          email: OWNER,
          password: "wrong one 1234",
        })
      ).status,
      401,
    );
    const owner = new Client(prod.mf);
    eq(
      (await owner.request("/auth/sign-in/email", "POST", { email: OWNER, password: PASSWORD }))
        .status,
      200,
      "Production owner signs in",
    );
    for (const path of [
      "/admin/products",
      "/admin/categories",
      "/admin/inventory",
      "/admin/orders",
      "/admin/banners",
      "/admin/business",
    ])
      eq((await owner.request(path)).status, 200, `Production admin ${path}`);
    eq((await guest.request("/admin/products")).status, 401, "Production: no session 401");
    eq((await guest.request("/health")).body.checkoutEnabled, false);
  } finally {
    await prod.mf.dispose();
  }
}
console.log(`PASS: ${checks} password-mode administrator authentication and security assertions`);
