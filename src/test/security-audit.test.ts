import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without type declarations
import { evaluate, newer } from "../../scripts/security-audit-lib.mjs";

const exception = {
  advisory: "GHSA-fc5q-39xc-vjpf",
  package: "picomatch",
  maxVersion: "4.0.7",
  expires: "2026-12-01",
  reason: "no patched release",
};
const picomatch = {
  picomatch: [
    {
      id: 1247710,
      url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
      title: "picomatch ReDoS",
      severity: "high",
    },
  ],
};
const other = {
  lodash: [
    {
      id: 1,
      url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
      title: "x",
      severity: "high",
    },
  ],
};
const run = (args: Record<string, unknown>) =>
  evaluate({
    exceptions: [exception],
    today: "2026-11-17",
    latest: { picomatch: "4.0.7" },
    ...args,
  });

describe("security audit gate with expiring exceptions", () => {
  it("passes the excepted advisory before expiry", () => {
    expect(run({ report: picomatch }).failures).toEqual([]);
  });
  it("still fails any other advisory", () => {
    const { failures } = run({ report: { ...picomatch, ...other } });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("GHSA-aaaa-bbbb-cccc");
  });
  it("does not let the exception cover the same advisory in another package", () => {
    const { failures } = run({ report: { micromatch: picomatch.picomatch } });
    expect(failures.some((f: string) => f.startsWith("micromatch"))).toBe(true);
  });
  it("fails on and after the expiry date", () => {
    expect(run({ report: picomatch, today: "2026-12-01" }).failures[0]).toContain("expired");
    expect(run({ report: picomatch, today: "2027-01-05" }).failures[0]).toContain("expired");
  });
  it("fails when a patched release is published (remove the exception)", () => {
    const { failures } = run({ report: picomatch, latest: { picomatch: "4.0.8" } });
    expect(failures[0]).toContain("picomatch@4.0.8 is published");
  });
  it("fails when the advisory is no longer reported (stale exception)", () => {
    expect(run({ report: {} }).failures[0]).toContain("no longer reported");
  });
  it("fails when the package appears in deployed artifacts", () => {
    const { failures } = run({
      report: picomatch,
      artifactHits: { "GHSA-fc5q-39xc-vjpf": [".worker-build/worker.js"] },
    });
    expect(failures[0]).toContain("deployed artifacts");
  });
  it("notes but does not fail when the registry is unreachable", () => {
    const { failures, notes } = run({ report: picomatch, latest: { picomatch: null } });
    expect(failures).toEqual([]);
    expect(notes.join(" ")).toContain("could not be checked");
  });
  it("compares versions numerically", () => {
    expect(newer("4.0.10", "4.0.7")).toBe(true);
    expect(newer("4.0.7", "4.0.7")).toBe(false);
    expect(newer("3.9.9", "4.0.7")).toBe(false);
  });
});
