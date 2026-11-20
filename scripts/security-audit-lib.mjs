// A failed or unavailable audit is never evidence of a clean dependency tree.
export function parseAuditReport(raw, exitCode) {
  if (exitCode !== 0 && exitCode !== 1) throw new Error("Audit command did not complete normally");
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Audit report is missing");
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    throw new Error("Audit report is invalid JSON");
  }
  if (!report || typeof report !== "object" || Array.isArray(report))
    throw new Error("Audit report has an unexpected format");
  let count = 0;
  for (const advisories of Object.values(report)) {
    if (!Array.isArray(advisories)) throw new Error("Audit report has an unexpected format");
    for (const advisory of advisories) {
      if (!advisory || typeof advisory.title !== "string" || typeof advisory.severity !== "string")
        throw new Error("Audit advisory has an unexpected format");
      count++;
    }
  }
  if (exitCode !== 0 && !count) throw new Error("Audit failed without an advisory report");
  return report;
}

// Pure evaluation for scripts/security-audit.mjs (unit-tested in src/test/security-audit.test.ts).
const ghsa = (advisory) => advisory.url?.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/)?.[0];
const parts = (v) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
export function newer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/**
 * @param report      bun audit --json output: { [package]: [{ url, title, severity, ... }] }
 * @param exceptions  entries from security/audit-exceptions.json
 * @param today       "YYYY-MM-DD" (UTC)
 * @param latest      { [package]: latest published version | null if unknown }
 * @param artifactHits { [advisory]: string[] } markers found in deployed artifacts
 */
export function evaluate({ report, exceptions, today, latest = {}, artifactHits = {} }) {
  const failures = [];
  const notes = [];
  const reported = new Set();
  for (const [pkg, advisories] of Object.entries(report ?? {}))
    for (const advisory of advisories) {
      const id = ghsa(advisory) ?? String(advisory.id);
      reported.add(id);
      const ex = exceptions.find((e) => e.advisory === id && e.package === pkg);
      if (!ex) {
        failures.push(`${pkg}: ${id} (${advisory.severity}) ${advisory.title}`);
        continue;
      }
      if (today >= ex.expires)
        failures.push(
          `${id}: exception expired on ${ex.expires}. Upgrade ${pkg} or obtain a new owner decision.`,
        );
      else
        notes.push(`${id} (${pkg} <= ${ex.maxVersion}) excepted until ${ex.expires}: ${ex.reason}`);
    }
  for (const ex of exceptions) {
    if (!reported.has(ex.advisory))
      failures.push(
        `${ex.advisory}: no longer reported by bun audit. Remove the exception from security/audit-exceptions.json.`,
      );
    const published = latest[ex.package];
    if (published && newer(published, ex.maxVersion))
      failures.push(
        `${ex.advisory}: ${ex.package}@${published} is published (newer than ${ex.maxVersion}). Upgrade via overrides and remove the exception.`,
      );
    if (published === null)
      notes.push(`${ex.package}: latest version could not be checked (registry unreachable).`);
    const hits = artifactHits[ex.advisory] ?? [];
    if (hits.length)
      failures.push(
        `${ex.advisory}: ${ex.package} code found in deployed artifacts (${hits.join(", ")}). The build-only assessment no longer holds.`,
      );
  }
  return { failures, notes };
}
