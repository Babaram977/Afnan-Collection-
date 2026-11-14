import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { authFor } from "./auth";
import type { CommerceEnv } from "./types";

export class SecurityError extends Error {
  constructor(
    public status: number,
    message = "Authentication could not be completed",
  ) {
    super(message);
  }
}
export const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
};
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const cookieName = (env: CommerceEnv) =>
  env.APP_ORIGIN.startsWith("https:") ? "__Host-afnan_admin" : "afnan_admin";
const cookie = (env: CommerceEnv, token: string, age: number) =>
  `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}`;
const reply = (data: unknown, env?: CommerceEnv, token?: string, age = 3600) =>
  Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      ...(env && token !== undefined ? { "Set-Cookie": cookie(env, token, age) } : {}),
    },
  });
type Primary = NonNullable<Awaited<ReturnType<ReturnType<typeof authFor>["api"]["getSession"]>>>;
type Security = { state: "pending" | "active" | "recovery" | "disabled"; epoch: number };
type Credential = { id: string; public_key: string; counter: number; transports: string };
export async function securityAudit(env: CommerceEnv, userId: string, action: string) {
  await env.DB.prepare("INSERT INTO audit(actor,action,entity_id) VALUES(?,?,?)")
    .bind(userId, action, userId)
    .run();
}
export async function securityLimit(env: CommerceEnv, identity: string, max = 10, seconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const key = await digest(`security:${identity}:${Math.floor(now / seconds)}`);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, now + seconds * 2)
    .first<{ count: number }>();
  if (!row || row.count > max) throw new SecurityError(429, "Too many requests. Try again later.");
}
async function state(env: CommerceEnv, userId: string) {
  return env.DB.prepare(
    "SELECT s.state,s.epoch FROM admin_security s JOIN staff r ON r.user_id=s.user_id WHERE s.user_id=?",
  )
    .bind(userId)
    .first<Security>();
}
export async function adminProof(
  request: Request,
  env: CommerceEnv,
  primary: Primary,
  recent = false,
) {
  if (!primary.user.emailVerified) return false;
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName(env)}=`))
    ?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await env.DB.prepare(
    `UPDATE admin_sessions SET last_seen=unixepoch()
    WHERE token_hash=? AND user_id=? AND session_id=? AND expires_at>unixepoch()
    AND last_seen>unixepoch()-900 ${recent ? "AND verified_at>unixepoch()-300" : ""}
    AND EXISTS(SELECT 1 FROM admin_security s JOIN staff r ON r.user_id=s.user_id
      WHERE s.user_id=admin_sessions.user_id AND s.state='active' AND s.epoch=admin_sessions.epoch AND r.role=admin_sessions.role)
    RETURNING token_hash`,
  )
    .bind(await digest(token), primary.user.id, primary.session.id)
    .first();
  return Boolean(row);
}
async function issueProof(env: CommerceEnv, primary: Primary, epoch: number) {
  const token = random();
  const row = await env.DB.prepare(
    `INSERT INTO admin_sessions(token_hash,user_id,session_id,epoch,role,expires_at)
    SELECT ?,?,?,?,(SELECT role FROM staff WHERE user_id=?),unixepoch()+3600 WHERE EXISTS(SELECT 1 FROM admin_security s JOIN staff r ON r.user_id=s.user_id
    JOIN user u ON u.id=s.user_id JOIN session p ON p.user_id=u.id
    WHERE s.user_id=? AND s.epoch=? AND s.state='active' AND u.email_verified=1 AND p.id=? AND p.expires_at>?) RETURNING token_hash`,
  )
    .bind(
      await digest(token),
      primary.user.id,
      primary.session.id,
      epoch,
      primary.user.id,
      primary.user.id,
      epoch,
      primary.session.id,
      Date.now(),
    )
    .first();
  if (!row) throw new SecurityError(403);
  return token;
}
function freshEmail(primary: Primary) {
  if (Date.now() - new Date(primary.session.createdAt).getTime() > 300000)
    throw new SecurityError(403, "Sign in again with a fresh email code before continuing");
}
export async function adminSecurity(
  request: Request,
  env: CommerceEnv,
  input: Record<string, unknown>,
) {
  const path = new URL(request.url).pathname.replace("/api/admin-security/", "");
  const primary = await authFor(env).api.getSession({ headers: request.headers });
  if (!primary?.user.emailVerified) throw new SecurityError(401, "Sign in required");
  const s = await state(env, primary.user.id);
  await securityLimit(env, `${primary.user.id}:${path}`);
  if (path === "status" && request.method === "GET")
    return reply({
      state: s?.state ?? "unavailable",
      verified: await adminProof(request, env, primary),
    });
  if (request.method !== "POST") throw new SecurityError(404);
  if (path === "logout") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM admin_sessions WHERE session_id=?").bind(primary.session.id),
      env.DB.prepare("DELETE FROM session WHERE id=?").bind(primary.session.id),
      env.DB.prepare("INSERT INTO audit(actor,action,entity_id) VALUES(?,'admin.logout',?)").bind(
        primary.user.id,
        primary.user.id,
      ),
    ]);
    return reply({ ok: true }, env, "", 0);
  }
  if (!s || s.state === "disabled") throw new SecurityError(403);
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new SecurityError(503);
  const credentials = (
    await env.DB.prepare(
      "SELECT id,public_key,counter,transports FROM admin_credentials WHERE user_id=?",
    )
      .bind(primary.user.id)
      .all<Credential>()
  ).results;
  const registering = path.startsWith("register/");
  if (registering) {
    if (s.state === "active") {
      if (!(await adminProof(request, env, primary, true)))
        throw new SecurityError(
          403,
          "Verify your security key again before changing security settings",
        );
    } else freshEmail(primary);
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_challenges WHERE expires_at<=unixepoch()"),
    env.DB.prepare(
      "DELETE FROM admin_sessions WHERE expires_at<=unixepoch() OR last_seen<=unixepoch()-900",
    ),
    env.DB.prepare("DELETE FROM auth_cooldowns WHERE expires_at<=unixepoch()"),
  ]);
  if (path === "register/options" || path === "authenticate/options") {
    if (!registering && (s.state !== "active" || !credentials.length)) throw new SecurityError(403);
    const options = registering
      ? await generateRegistrationOptions({
          rpName: "Afnan Collection",
          rpID: origin.hostname,
          userName: primary.user.email,
          userID: new TextEncoder().encode(primary.user.id),
          attestationType: "none",
          supportedAlgorithmIDs: [-7, -257],
          authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
          excludeCredentials: credentials.map((c) => ({ id: c.id })),
        })
      : await generateAuthenticationOptions({
          rpID: origin.hostname,
          userVerification: "required",
          allowCredentials: credentials.map((c) => ({ id: c.id })),
        });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO admin_challenges(id,user_id,session_id,epoch,kind,challenge,expires_at) VALUES(?,?,?,?,?,?,unixepoch()+120)",
    )
      .bind(
        id,
        primary.user.id,
        primary.session.id,
        s.epoch,
        registering ? "register" : "authenticate",
        options.challenge,
      )
      .run();
    return reply({ id, options });
  }
  if (path === "register/verify" || path === "authenticate/verify") {
    if (
      typeof input["id"] !== "string" ||
      !input["response"] ||
      typeof input["response"] !== "object"
    )
      throw new SecurityError(400);
    // Consume before cryptographic validation: a challenge is never reusable, even after failure.
    const challenge = await env.DB.prepare(
      "DELETE FROM admin_challenges WHERE id=? AND user_id=? AND session_id=? AND epoch=? AND kind=? AND expires_at>unixepoch() RETURNING challenge",
    )
      .bind(
        input["id"],
        primary.user.id,
        primary.session.id,
        s.epoch,
        registering ? "register" : "authenticate",
      )
      .first<{ challenge: string }>();
    if (!challenge) {
      await securityAudit(env, primary.user.id, "admin.mfa.challenge_rejected");
      throw new SecurityError(400);
    }
    try {
      if (registering) {
        const result = await verifyRegistrationResponse({
          response: input["response"] as RegistrationResponseJSON,
          expectedChallenge: challenge.challenge,
          expectedOrigin: env.APP_ORIGIN,
          expectedRPID: origin.hostname,
          requireUserVerification: true,
          supportedAlgorithmIDs: [-7, -257],
        });
        if (!result.verified) throw new Error("Invalid authenticator");
        const c = result.registrationInfo.credential;
        const codes = Array.from({ length: 8 }, random);
        const codeHashes = await Promise.all(codes.map((code) => digest(code)));
        // Epoch compare-and-set prevents stale enrollment from undoing a concurrent reset/disable.
        const results = await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO admin_credentials(id,user_id,public_key,counter,transports) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_security WHERE user_id=? AND epoch=? AND state=?)",
          ).bind(
            c.id,
            primary.user.id,
            btoa(String.fromCharCode(...c.publicKey)),
            c.counter,
            JSON.stringify(c.transports ?? []),
            primary.user.id,
            s.epoch,
            s.state,
          ),
          env.DB.prepare(
            "UPDATE admin_security SET state='active' WHERE user_id=? AND epoch=? AND state=? AND EXISTS(SELECT 1 FROM admin_credentials WHERE id=? AND user_id=?)",
          ).bind(primary.user.id, s.epoch, s.state, c.id, primary.user.id),
          ...(s.state === "active"
            ? []
            : codeHashes.map((codeHash) =>
                env.DB.prepare(
                  "INSERT INTO admin_recovery_codes(code_hash,user_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM admin_credentials WHERE id=? AND user_id=?)",
                ).bind(codeHash, primary.user.id, c.id, primary.user.id),
              )),
          env.DB.prepare(
            "INSERT INTO audit(actor,action,entity_id) SELECT ?,'admin.mfa.enrolled',? WHERE EXISTS(SELECT 1 FROM admin_credentials WHERE id=? AND user_id=?)",
          ).bind(primary.user.id, primary.user.id, c.id, primary.user.id),
        ]);
        if (!results[0]?.meta.changes) throw new Error("Enrollment state changed");
        await env.DB.prepare("DELETE FROM admin_sessions WHERE user_id=?")
          .bind(primary.user.id)
          .run();
        const token = await issueProof(env, primary, s.epoch);
        return reply({ ok: true, recoveryCodes: s.state === "active" ? [] : codes }, env, token);
      }
      const response = input["response"] as AuthenticationResponseJSON;
      const c = credentials.find((c) => c.id === response.id);
      if (!c || s.state !== "active") throw new Error("Invalid authenticator");
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: env.APP_ORIGIN,
        expectedRPID: origin.hostname,
        requireUserVerification: true,
        credential: {
          id: c.id,
          publicKey: Uint8Array.from(atob(c.public_key), (v) => v.charCodeAt(0)),
          counter: c.counter,
        },
      });
      if (!result.verified) throw new Error("Invalid authenticator");
      const updated = await env.DB.prepare(
        "UPDATE admin_credentials SET counter=? WHERE id=? AND counter=? RETURNING id",
      )
        .bind(result.authenticationInfo.newCounter, c.id, c.counter)
        .first();
      if (!updated) throw new Error("Authenticator changed");
      // Rotate rather than extend an existing privileged session.
      await env.DB.prepare("DELETE FROM admin_sessions WHERE session_id=?")
        .bind(primary.session.id)
        .run();
      const token = await issueProof(env, primary, s.epoch);
      await securityAudit(env, primary.user.id, "admin.mfa.verified");
      return reply({ ok: true }, env, token);
    } catch {
      await securityAudit(env, primary.user.id, "admin.mfa.failed");
      throw new SecurityError(400);
    }
  }
  if (path === "recover") {
    freshEmail(primary);
    if (
      s.state !== "active" ||
      typeof input["code"] !== "string" ||
      !/^[a-f0-9]{64}$/.test(input["code"])
    )
      throw new SecurityError(400);
    const codeHash = await digest(input["code"]);
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE admin_security SET state='recovery',epoch=epoch+1 WHERE user_id=? AND epoch=? AND state='active' AND EXISTS(SELECT 1 FROM admin_recovery_codes WHERE code_hash=? AND user_id=? AND used_at IS NULL)",
      ).bind(primary.user.id, s.epoch, codeHash, primary.user.id),
      env.DB.prepare(
        "UPDATE admin_recovery_codes SET used_at=unixepoch() WHERE user_id=? AND EXISTS(SELECT 1 FROM admin_security WHERE user_id=? AND epoch=? AND state='recovery')",
      ).bind(primary.user.id, primary.user.id, s.epoch + 1),
      env.DB.prepare(
        "DELETE FROM admin_credentials WHERE user_id=? AND EXISTS(SELECT 1 FROM admin_security WHERE user_id=? AND epoch=? AND state='recovery')",
      ).bind(primary.user.id, primary.user.id, s.epoch + 1),
      env.DB.prepare(
        "DELETE FROM session WHERE user_id=? AND EXISTS(SELECT 1 FROM admin_security WHERE user_id=? AND epoch=? AND state='recovery')",
      ).bind(primary.user.id, primary.user.id, s.epoch + 1),
    ]);
    await securityAudit(
      env,
      primary.user.id,
      results[0]?.meta.changes ? "admin.recovery.started" : "admin.recovery.failed",
    );
    if (!results[0]?.meta.changes) throw new SecurityError(400);
    // Recovery authorizes only fresh email sign-in and new MFA enrollment; no privileged session.
    return reply({ ok: true, signInAgain: true }, env, "", 0);
  }
  throw new SecurityError(404);
}
