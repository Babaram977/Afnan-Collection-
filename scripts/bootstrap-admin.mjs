// Local-only bootstrap. Production role assignment needs a separately reviewed
// account-owned procedure. There is deliberately no public bootstrap endpoint.
import { spawnSync } from "node:child_process";
const email = process.argv[2];
if (!email || !/^[a-zA-Z0-9.!#$%&*+\/=?^_`{|}~-]+@[a-zA-Z0-9.-]+$/.test(email))
  throw new Error("Usage: bun run admin:bootstrap -- verified-email@example.com");
const sql = `INSERT INTO staff(user_id,role) SELECT id,'admin' FROM user WHERE email='${email.toLowerCase()}' AND email_verified=1 ON CONFLICT(user_id) DO NOTHING; SELECT user.email,staff.role FROM staff JOIN user ON user.id=staff.user_id WHERE user.email='${email.toLowerCase()}';`;
const result = spawnSync(
  "node",
  [
    "node_modules/wrangler/bin/wrangler.js",
    "--config",
    "wrangler.jsonc",
    "d1",
    "execute",
    "DB",
    "--local",
    "--command",
    sql,
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
