import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestApp, Client } from "./harness.mjs";
import { Authenticator } from "./authenticator.mjs";
import { bootstrapSQL } from "../scripts/admin-bootstrap-plan.mjs";
const { mf, db } = await createTestApp();
let checks = 0;
function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks++;
}
const hash = (s) => createHash("sha256").update(s).digest("hex");
const ownerEmail = "admin@afnancollectionkn.com";
async function clearLimits() {
  await db.batch([db.prepare("DELETE FROM rate_limits"), db.prepare("DELETE FROM auth_cooldowns")]);
}
async function options(client, kind = "authenticate") {
  return client.request(`/admin-security/${kind}/options`, "POST", {});
}
async function verify(client, opt, response, kind = "authenticate") {
  return client.request(`/admin-security/${kind}/verify`, "POST", { id: opt.body.id, response });
}
async function signIn(client, email = ownerEmail) {
  await clearLimits();
  return client.signIn(db, email);
}
try {
  const guest = new Client(mf),
    owner = new Client(mf),
    customer = new Client(mf);
  equal((await guest.request("/admin-security/status")).status, 401, "Guest denied");
  const me = await signIn(owner);
  equal(me.role, null, "Email alone never grants staff");
  equal((await options(owner, "register")).status, 403, "No public bootstrap");
  assert.throws(() =>
    bootstrapSQL({ email: "stranger@example.com", approval: "ref", operator: "op1" }),
  );
  checks++;
  assert.throws(() => bootstrapSQL({ email: ownerEmail, approval: "bad'input", operator: "op1" }));
  checks++;
  const sql = bootstrapSQL({
    email: ownerEmail,
    approval: "fixture-evidence",
    operator: "fixture-operator",
  });
  const apply = () =>
    db.batch(
      sql
        .split(";")
        .filter((s) => s.trim())
        .map((s) => db.prepare(s)),
    );
  await apply();
  await apply();
  equal(
    await db.prepare("SELECT COUNT(*) FROM admin_security").first("COUNT(*)"),
    1,
    "Bootstrap idempotent",
  );
  equal(
    await db
      .prepare("SELECT COUNT(*) FROM audit WHERE action='admin.bootstrap.pending'")
      .first("COUNT(*)"),
    1,
    "Bootstrap audit idempotent",
  );
  equal((await owner.request("/admin/products")).status, 403, "Staff role alone denied");
  await db.prepare("UPDATE user SET email_verified=0 WHERE id=?").bind(me.userId).run();
  equal((await options(owner, "register")).status, 401, "Unverified email denied enrollment");
  await db.prepare("UPDATE user SET email_verified=1 WHERE id=?").bind(me.userId).run();
  await db
    .prepare("UPDATE session SET created_at=? WHERE user_id=?")
    .bind(Date.now() - 301000, me.userId)
    .run();
  equal((await options(owner, "register")).status, 403, "Old primary session cannot enroll");
  await db
    .prepare("UPDATE session SET created_at=? WHERE user_id=?")
    .bind(Date.now(), me.userId)
    .run();
  const key = new Authenticator();
  let opt = await options(owner, "register");
  equal(opt.status, 200, "Enrollment options");
  equal(opt.body.options.authenticatorSelection.userVerification, "required", "UV required");
  await db.prepare("UPDATE admin_challenges SET expires_at=unixepoch()-1").run();
  equal(
    (await verify(owner, opt, key.registration(opt.body.options), "register")).status,
    400,
    "Expired registration",
  );
  opt = await options(owner, "register");
  equal(
    (await verify(owner, opt, key.registration(opt.body.options, { flags: 0x41 }), "register"))
      .status,
    400,
    "Registration without user verification denied",
  );
  equal(
    (await verify(owner, opt, key.registration(opt.body.options), "register")).status,
    400,
    "Failed challenge consumed",
  );
  opt = await options(owner, "register");
  equal(
    (
      await verify(
        owner,
        opt,
        key.registration(opt.body.options, { origin: "https://attacker.example" }),
        "register",
      )
    ).status,
    400,
    "Wrong enrollment origin",
  );
  opt = await options(owner, "register");
  const registration = key.registration(opt.body.options);
  const enrolled = await verify(owner, opt, registration, "register");
  equal(enrolled.status, 200, "Cryptographic enrollment succeeds");
  equal(enrolled.body.recoveryCodes.length, 8, "Recovery codes shown once");
  const codes = enrolled.body.recoveryCodes;
  equal(
    await db
      .prepare("SELECT code_hash FROM admin_recovery_codes WHERE code_hash=?")
      .bind(hash(codes[0]))
      .first("code_hash"),
    hash(codes[0]),
    "Only code hash stored",
  );
  equal(
    await db
      .prepare("SELECT code_hash FROM admin_recovery_codes WHERE code_hash=?")
      .bind(codes[0])
      .first(),
    null,
    "No plaintext recovery code",
  );
  equal((await verify(owner, opt, registration, "register")).status, 400, "Registration replay");
  equal(
    (await owner.request("/admin/products")).status,
    200,
    "Email plus independent key grants role",
  );
  const cookie = enrolled.headers.get("set-cookie");
  equal(/HttpOnly/.test(cookie) && /SameSite=Strict/.test(cookie), true, "Privileged cookie flags");
  const token = owner.cookies.get("afnan_admin");
  equal(
    await db
      .prepare("SELECT token_hash FROM admin_sessions WHERE token_hash=?")
      .bind(token)
      .first(),
    null,
    "No plaintext privileged token",
  );
  const customerMe = await signIn(customer, "customer-fixture@example.com");
  customer.cookies.set("afnan_admin", token);
  equal(
    (await customer.request("/admin/products")).status,
    403,
    "Stolen proof not valid for another identity",
  );
  equal(
    (await customer.request("/admin/products", "POST", { role: "admin", userId: me.userId }))
      .status,
    403,
    "Client role escalation denied",
  );
  equal((await options(customer, "register")).status, 403, "Customer cannot enroll staff MFA");
  equal(
    (
      await owner.request(
        "/admin-security/register/options",
        "POST",
        {},
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
    "CSRF origin",
  );
  await db.prepare("UPDATE admin_sessions SET last_seen=unixepoch()-901").run();
  equal((await owner.request("/admin/products")).status, 403, "Idle expiry");
  opt = await options(owner);
  equal(opt.body.options.userVerification, "required", "Authentication UV required");
  let response = key.authentication(opt.body.options);
  const authenticated = await verify(owner, opt, response);
  equal(authenticated.status, 200, "Signed assertion succeeds");
  equal(owner.cookies.get("afnan_admin") !== token, true, "Privileged token rotates");
  equal((await verify(owner, opt, response)).status, 400, "Assertion replay denied");
  opt = await options(owner);
  equal(
    (await verify(owner, opt, key.authentication(opt.body.options, { flags: 0x01 }))).status,
    400,
    "Signed assertion without UV denied",
  );
  opt = await options(owner);
  equal(
    (
      await verify(
        owner,
        opt,
        key.authentication(opt.body.options, { origin: "https://evil.example" }),
      )
    ).status,
    400,
    "Wrong assertion origin denied",
  );
  opt = await options(owner);
  response = new Authenticator().authentication(opt.body.options);
  response.id = key.id.toString("base64url");
  equal((await verify(owner, opt, response)).status, 400, "Invalid signature denied");
  opt = await options(owner);
  await db.prepare("UPDATE admin_challenges SET expires_at=unixepoch()-1").run();
  equal(
    (await verify(owner, opt, key.authentication(opt.body.options))).status,
    400,
    "Expired assertion",
  );
  await clearLimits();
  await db.prepare("UPDATE admin_sessions SET expires_at=unixepoch()-1").run();
  equal((await owner.request("/admin/products")).status, 403, "Absolute expiry");
  opt = await options(owner);
  await verify(owner, opt, key.authentication(opt.body.options));
  await db.prepare("UPDATE admin_sessions SET verified_at=unixepoch()-301").run();
  equal(
    (await options(owner, "register")).status,
    403,
    "Sensitive changes require recent independent MFA",
  );
  opt = await options(owner);
  await verify(owner, opt, key.authentication(opt.body.options));
  const backup = new Authenticator();
  opt = await options(owner, "register");
  const added = await verify(owner, opt, backup.registration(opt.body.options), "register");
  equal(added.status, 200, "Backup key enrollment");
  equal(added.body.recoveryCodes, [], "Existing codes not redisplayed");
  await db
    .prepare("UPDATE admin_security SET state='disabled',epoch=epoch+1 WHERE user_id=?")
    .bind(me.userId)
    .run();
  equal(
    (await owner.request("/admin/products")).status,
    403,
    "Disablement immediately revokes privilege",
  );
  equal((await options(owner)).status, 403, "Disabled account cannot authenticate");
  await db
    .prepare("UPDATE admin_security SET state='active' WHERE user_id=?")
    .bind(me.userId)
    .run();
  equal((await owner.request("/admin/products")).status, 403, "Old epoch proof stays revoked");
  await clearLimits();
  equal(
    (await owner.request("/admin-security/recover", "POST", { code: "0".repeat(64) })).status,
    400,
    "Invalid recovery code denied",
  );
  const recovery = await owner.request("/admin-security/recover", "POST", { code: codes[0] });
  equal(recovery.status, 200, "Valid recovery starts restricted re-enrollment");
  equal(
    await db
      .prepare("SELECT COUNT(*) FROM session WHERE user_id=?")
      .bind(me.userId)
      .first("COUNT(*)"),
    0,
    "Recovery revokes every primary session",
  );
  equal(
    await db
      .prepare("SELECT COUNT(*) FROM admin_credentials WHERE user_id=?")
      .bind(me.userId)
      .first("COUNT(*)"),
    0,
    "Recovery invalidates old authenticators",
  );
  equal(
    (await owner.request("/admin/products")).status,
    401,
    "Recovery never grants privileged access",
  );
  await signIn(owner);
  equal(
    (await owner.request("/admin/products")).status,
    403,
    "Fresh email alone still insufficient after recovery",
  );
  equal(
    (await owner.request("/admin-security/recover", "POST", { code: codes[0] })).status,
    400,
    "Used code replay denied",
  );
  const replacement = new Authenticator();
  opt = await options(owner, "register");
  const reEnrolled = await verify(
    owner,
    opt,
    replacement.registration(opt.body.options),
    "register",
  );
  equal(reEnrolled.status, 200, "New MFA mandatory after recovery");
  equal((await owner.request("/admin/products")).status, 200, "Access restored only after new MFA");
  equal(
    (await owner.request("/admin-security/recover", "POST", { code: codes[1] })).status,
    400,
    "Old recovery set invalidated",
  );
  await clearLimits();
  let limited;
  for (let n = 0; n < 11; n++) limited = await options(owner);
  equal(limited.status, 429, "Durable per-identity MFA rate limit");
  await clearLimits();
  const sent = await guest.request("/auth/email-otp/send-verification-otp", "POST", {
    email: "cooldown@example.com",
    type: "sign-in",
  });
  equal(sent.status, 200, "Email code request");
  equal(
    (
      await guest.request("/auth/email-otp/send-verification-otp", "POST", {
        email: "cooldown@example.com",
        type: "sign-in",
      })
    ).status,
    429,
    "Durable resend cooldown",
  );
  await clearLimits();
  const otpClient = new Client(mf);
  await otpClient.request("/auth/email-otp/send-verification-otp", "POST", {
    email: "attempts@example.com",
    type: "sign-in",
  });
  const otp = await db
    .prepare("SELECT code FROM test_outbox WHERE email='attempts@example.com'")
    .first("code");
  equal(
    (
      await db
        .prepare("SELECT value FROM verification WHERE identifier LIKE '%attempts@example.com%'")
        .all()
    ).results.some((row) => row.value.includes(otp)),
    false,
    "OTP stored hashed",
  );
  for (let n = 0; n < 6; n++) {
    otpClient.ip = `198.51.100.${n + 1}`;
    await otpClient.request("/auth/sign-in/email-otp", "POST", {
      email: "attempts@example.com",
      otp: otp === "000000" ? "111111" : "000000",
    });
  }
  otpClient.ip = "198.51.100.200";
  equal(
    (
      await otpClient.request("/auth/sign-in/email-otp", "POST", {
        email: "attempts@example.com",
        otp,
      })
    ).status,
    400,
    "OTP attempt limit invalidates code",
  );
  await clearLimits();
  await otpClient.request("/auth/email-otp/send-verification-otp", "POST", {
    email: "expired@example.com",
    type: "sign-in",
  });
  const expired = await db
    .prepare("SELECT code FROM test_outbox WHERE email='expired@example.com'")
    .first("code");
  await db
    .prepare("UPDATE verification SET expires_at=? WHERE identifier LIKE '%expired@example.com%'")
    .bind(Date.now() - 1000)
    .run();
  equal(
    (
      await otpClient.request("/auth/sign-in/email-otp", "POST", {
        email: "expired@example.com",
        otp: expired,
      })
    ).status,
    400,
    "Expired email code denied",
  );
  equal(
    (
      await otpClient.request("/auth/email-otp/verify-email", "POST", {
        email: ownerEmail,
        otp: expired,
      })
    ).status,
    404,
    "Unneeded auth mutation endpoint denied",
  );
  const logout = await owner.request("/admin-security/logout", "POST", {});
  equal(logout.status, 200, "Server-side logout");
  equal(
    (await owner.request("/admin/products")).status,
    401,
    "Logout invalidates primary and proof",
  );
  equal(
    (await db.prepare("PRAGMA foreign_key_check").all()).results,
    [],
    "Migration foreign-key integrity",
  );
  equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit WHERE action IN ('admin.mfa.enrolled','admin.mfa.failed','admin.recovery.started','admin.logout')",
        )
        .first()
    ).n >= 4,
    true,
    "Audit covers enrollment failure recovery logout",
  );
  equal(
    (await db.prepare("SELECT * FROM audit").all()).results.some((row) =>
      JSON.stringify(row).includes(codes[0]),
    ),
    false,
    "No recovery codes in audit",
  );
  equal(customerMe.role, null, "Customer account remains separate");
  console.log(
    `PASS: ${checks} administrator authentication, WebAuthn, recovery, authorization and migration checks (local fixtures only)`,
  );
} finally {
  await mf.dispose();
}

// HTTPS cookie contract in the same Workers runtime; no network/email provider calls.
const secureApp = await createTestApp({ bindings: { APP_ORIGIN: "https://localhost" } });
try {
  const client = new Client(secureApp.mf, "https://localhost");
  const identity = await client.signIn(secureApp.db, "secure-fixture@example.com");
  await secureApp.db.batch([
    secureApp.db.prepare("INSERT INTO staff(user_id,role) VALUES(?,'admin')").bind(identity.userId),
    secureApp.db
      .prepare(
        "INSERT INTO admin_security(user_id,state,approval_ref,verified_by) VALUES(?,'pending','fixture-evidence','fixture-operator')",
      )
      .bind(identity.userId),
  ]);
  const key = new Authenticator();
  const opt = await options(client, "register");
  const result = await verify(
    client,
    opt,
    key.registration(opt.body.options, { origin: "https://localhost" }),
    "register",
  );
  equal(result.status, 200, "HTTPS enrollment");
  const cookie = result.headers.get("set-cookie");
  equal(cookie.startsWith("__Host-afnan_admin="), true, "Host-only cookie prefix");
  equal(/; Secure/.test(cookie) && !/Domain=/.test(cookie), true, "Secure host-bound cookie");
  equal((await client.request("/admin/products")).status, 200, "HTTPS privileged session");
  await secureApp.db
    .prepare("UPDATE staff SET role='fulfilment' WHERE user_id=?")
    .bind(identity.userId)
    .run();
  equal(
    await secureApp.db
      .prepare("SELECT COUNT(*) AS n FROM admin_sessions WHERE user_id=?")
      .bind(identity.userId)
      .first("n"),
    0,
    "Role mutation revokes privileged sessions",
  );
  equal(
    (await client.request("/admin/products")).status,
    401,
    "Primary session revocation denies proof",
  );
} finally {
  await secureApp.mf.dispose();
}
const production = await createTestApp({
  bindings: {
    APP_ENV: "production",
    TEST_FIXTURES: "true",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
  },
});
try {
  const client = new Client(production.mf);
  await production.db
    .prepare(
      "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('pending-owner','Owner',?,0,?,?)",
    )
    .bind(ownerEmail, Date.now(), Date.now())
    .run();
  equal(
    (
      await client.request("/auth/email-otp/send-verification-otp", "POST", {
        email: ownerEmail,
        type: "sign-in",
      })
    ).status,
    200,
    "Provider failure acknowledgement does not enumerate known owner",
  );
  equal(
    (
      await client.request("/auth/email-otp/send-verification-otp", "POST", {
        email: "unknown@example.com",
        type: "sign-in",
      })
    ).status,
    200,
    "Unknown owner gets same acknowledgement",
  );
  equal(
    await production.db.prepare("SELECT COUNT(*) AS n FROM test_outbox").first("n"),
    0,
    "Production cannot use fixture mail even with flag",
  );
  equal(
    await production.db.prepare("SELECT COUNT(*) AS n FROM user").first("n"),
    1,
    "Unknown production identity not registered",
  );
} finally {
  await production.mf.dispose();
}
console.log(
  `PASS: ${checks} total security assertions including HTTPS cookies and production-mode denial`,
);
