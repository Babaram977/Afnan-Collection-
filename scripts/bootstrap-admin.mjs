// Local-only, controlled pending enrollment; never grants an active admin session.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapSQL } from "./admin-bootstrap-plan.mjs";
const [email, approval, operator, mode] = process.argv.slice(2);
if (mode !== "--apply-local")
  throw new Error(
    "Usage: bun run admin:bootstrap -- admin@afnancollectionkn.com approval-reference operator-reference --apply-local. Human verification must be completed first. Remote provisioning requires separate approval.",
  );
const sql = bootstrapSQL({ email, approval, operator });
const dir = mkdtempSync(join(tmpdir(), "afnan-bootstrap-"));
try {
  const path = join(dir, "pending.sql");
  writeFileSync(path, sql, { mode: 0o600 });
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
      "--file",
      path,
    ],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
