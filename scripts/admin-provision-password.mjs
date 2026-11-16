// Operator provisioning for password-mode administrators (ADMIN_AUTH_MODE=password).
// Prints SQL that creates the user (if absent), grants the staff role and stores a one-time
// password-setup token as a SHA-256 digest. The plaintext token is returned separately and must
// be handed to the owner only as the setup link; it is never stored. No password is handled here:
// the owner chooses it on the setup page and Better Auth hashes it.
import { createHash, randomBytes, randomUUID } from "node:crypto";

export function provisionPasswordAdmin({
  email,
  role = "admin",
  ttlMinutes = 30,
  now = Date.now(),
}) {
  if (!/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email ?? ""))
    throw new Error("Valid email required");
  if (!["admin", "fulfilment"].includes(role)) throw new Error("Unknown role");
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");
  const digest = createHash("sha256").update(token).digest("hex");
  const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
  const expires = now + ttlMinutes * 60_000;
  const sql = [
    `INSERT INTO user(id,name,email,email_verified,created_at,updated_at)
SELECT ${q(randomUUID())},'Afnan administrator',${q(normalized)},0,${now},${now}
WHERE NOT EXISTS(SELECT 1 FROM user WHERE lower(email)=${q(normalized)})`,
    `INSERT INTO staff(user_id,role) SELECT id,${q(role)} FROM user WHERE lower(email)=${q(normalized)}
ON CONFLICT(user_id) DO UPDATE SET role=excluded.role`,
    `DELETE FROM verification WHERE identifier LIKE 'admin-setup:%'
AND value=(SELECT id FROM user WHERE lower(email)=${q(normalized)})`,
    `INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at)
SELECT ${q(randomUUID())},${q("admin-setup:" + digest)},id,${expires},${now},${now}
FROM user WHERE lower(email)=${q(normalized)}`,
    `INSERT INTO audit(actor,action,entity_id)
SELECT 'operator','admin.provisioned.password_mode',id FROM user WHERE lower(email)=${q(normalized)}`,
  ];
  return { statements: sql, token, expiresAt: new Date(expires).toISOString() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [email, role] = process.argv.slice(2);
  const { statements, token, expiresAt } = provisionPasswordAdmin({ email, role });
  // SQL to stdout; the setup token to stderr so it is not captured with the SQL.
  process.stdout.write(statements.join(";\n") + ";\n");
  process.stderr.write(`setup token (single use, expires ${expiresAt}): ${token}\n`);
}
