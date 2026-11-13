# Resume development

## Mandatory continuity workflow

1. Read AGENTS.md and all five records in this directory.
2. Fetch current branches, PR diffs/reviews and exact-head CI. Reconcile stale records against current GitHub evidence.
3. Update relevant records alongside meaningful implementation milestones. Preserve earlier decisions and reasons; keep this repository's records separate from Heroine and DrippleX.
4. Never record secrets/customer information or merge/deploy just to maintain records.

## Next work

- Review the initialization draft PR and backend proposal; no merge is authorized in this task.
- Complete owner-preferred private visibility before operational configuration. Keep secrets out of Git regardless.
- Establish clean frozen-install CI and pinned toolchain, resolve existing lint in a scoped change, then add Wrangler dry-run, workerd and browser checks. Build success alone is not runtime acceptance.
- Confirm staff identity, Cloudflare account/limits and D1/R2 proposal before provisioning. See docs/engineering/INITIAL-ASSESSMENT.md for gates.
- Obtain real catalog, opening stock and factual business/policy content. Implement protected admin/catalog/inventory first while checkout remains disabled.
- Resolve order, delivery, payment, refund and retention rules before commerce implementation. Later activation requires explicit authorization and passing concurrency, permissions, idempotency and payment reconciliation tests.

Preserve src/styles.css, shared site components and docs/design/AFNAN-UI-STANDARD.md; no redesign is part of the handoff.
