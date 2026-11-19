// Security gate: bun audit with narrow, expiring, owner-approved exceptions.
// Fails on any advisory without an exception, an expired exception, an exception that is no longer
// needed, a published patched release, or excepted package code inside deployed artifacts.
// Requires `bun run worker:build` first (checks .worker-build/worker.js and .output/public).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { evaluate, parseAuditReport } from "./security-audit-lib.mjs";

const { exceptions } = JSON.parse(readFileSync("security/audit-exceptions.json", "utf8"));
let raw;
let exitCode = 0;
try {
  raw = execFileSync("bun", ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch (error) {
  raw = error.stdout ?? "";
  exitCode = error.status ?? null;
}
let report;
try {
  report = parseAuditReport(raw, exitCode);
} catch (error) {
  console.error(`security-audit: FAIL: ${error.message}`);
  process.exit(1);
}

const latest = {};
for (const ex of exceptions) {
  try {
    latest[ex.package] = execFileSync("npm", ["view", ex.package, "version"], {
      encoding: "utf8",
      timeout: 30000,
    }).trim();
  } catch {
    latest[ex.package] = null;
  }
}

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(js|mjs|html|css)$/.test(p) ? [p] : [];
  });
const artifacts = [".worker-build/worker.js"].filter(existsSync);
if (!artifacts.length || !existsSync(".output/public")) {
  console.error("security-audit: build artifacts missing. Run `bun run worker:build` first.");
  process.exit(1);
}
artifacts.push(...files(".output/public"));
const artifactHits = {};
for (const ex of exceptions)
  artifactHits[ex.advisory] = artifacts.filter((f) => {
    const text = readFileSync(f, "utf8");
    return ex.artifactMarkers.some((m) => text.includes(m));
  });

const today = new Date().toISOString().slice(0, 10);
const { failures, notes } = evaluate({ report, exceptions, today, latest, artifactHits });
for (const n of notes) console.log(`note: ${n}`);
console.log(
  `checked ${artifacts.length} deployed artifact files; latest: ${JSON.stringify(latest)}`,
);
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log("security-audit: PASS");
