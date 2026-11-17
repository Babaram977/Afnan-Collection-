# Deployment automation (owner-authorized 2026-11-16)

## Flow

```
PR → "Validate Afnan" (all suites + bun audit) → auto-merge when green, mergeable and conflict-free
main push → "Validate Afnan" → success → "Deploy Afnan acceptance" (automatic)
          → success → "Deploy Afnan production" (automatic; Worker has no hostname until launch)
```

- Each deploy workflow still builds in a job **without secrets**, re-runs the test suites, and ships a SHA-256-manifested artifact.
- The deploy job never runs application code.

## Automatic-run settings (repository variables, owner-controlled)

| Variable                        | Default when unset | Meaning                                                              |
| ------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `AFNAN_ACCEPTANCE_CHECKOUT`     | `disabled`         | acceptance checkout                                                  |
| `AFNAN_ACCEPTANCE_EMAIL_SENDER` | `verified`         | acceptance sign-in/notification email (key installed 2026-11-16)     |
| `AFNAN_PRODUCTION_CHECKOUT`     | `disabled`         | **launch switch**: set to `enabled` only under launch authorization  |
| `AFNAN_PRODUCTION_EMAIL_SENDER` | `unverified`       | set to `verified` after `RESEND_API_KEY` is on the production Worker |

- Manual `workflow_dispatch` keeps its inputs and is restricted to the repository owner.
- `PAYMENT_MODE` is pinned `disabled` in both workflows, and the run aborts if it is changed.
- The production run also aborts if `workers_dev` or any route appears in its configuration.

## Safeguards kept

- **Triggers:** automatic runs fire only for a successful upstream run of a **push to `main` in this repository**. Fork and PR code never reaches a job holding `CLOUDFLARE_API_TOKEN`.
- **Database:** workflows never apply migrations. A deploy **fails** if the commit carries migrations not yet applied to the target D1 (`wrangler d1 migrations list --remote` must report none pending). D1 Time Travel remains the data restore path.
- **Rollback:** each run records the version live before it deployed in the run summary (`wrangler rollback <version-id>`).
- **Secrets:** each environment holds its own `CLOUDFLARE_API_TOKEN`; Worker secrets stay in Cloudflare.
- **Separately authorized and outside these workflows:** Access policies, DNS/hostname, payment credentials, administrator provisioning and production data.

## Owner settings (GitHub UI; cannot be set from the operator session)

1. **Settings → General → Pull Requests:** enable _Allow auto-merge_.
2. **Settings → Rules → Rulesets → New branch ruleset** for `main`:
   - require a pull request (0 approvals);
   - require status check `test` (workflow _Validate Afnan_) and branches up to date;
   - block force pushes and deletions.

   Without a required check, auto-merge would merge immediately, so this ruleset is what enforces "never merge failing CI".

3. **Settings → Environments → `afnan-acceptance`:** remove _Required reviewers_; keep deployment branches = `main`.
4. **Settings → Environments → `afnan-production`:** create it if absent; deployment branches = `main`; no reviewers; secret `CLOUDFLARE_API_TOKEN` (needs Workers Scripts Edit plus D1 Read for the migration check).

## Exact-commit chain (follow-up)

- **Acceptance (automatic)** deploys the `head_sha` of the successful _Validate Afnan_ push run, which is the exact validated commit.
- **Production (automatic)** takes the commit from the triggering acceptance run's name (`Acceptance deploy <sha> …`), not from that run's `head_sha` (main's tip at trigger time). Both environments therefore receive the same commit.
- **Production (any mode)** refuses commits that are not ancestors of `origin/main`.
- Every deploy also re-runs the full test suite in its own secret-free build job before anything is uploaded, so no deployment path skips validation.

## Production release gate (owner decision 2026-11-17)

- **Release gate:** production no longer deploys automatically after acceptance. The automatic run is skipped unless the repository variable `AFNAN_PRODUCTION_AUTO_DEPLOY` is `enabled` (it is unset).
- **Acceptance:** still deploys automatically after every merge to `main`.
- **Releasing to production:** after the owner approves an exact commit validated on acceptance, run **Deploy Afnan production** manually (repository owner only) with that commit. The workflow still requires the commit to be on `main`, runs every test suite, refuses pending migrations and records the rollback version.

## Security audit exceptions (owner decision 2026-11-17)

- **The gate:** CI and both deploy workflows run `bun run security:audit` (`scripts/security-audit.mjs`) instead of plain `bun audit`. It runs `bun audit --json` and fails on **any** advisory unless `security/audit-exceptions.json` holds a matching exception (same advisory **and** package).
- **When an exception stops working**, the gate fails on any of these:
  - the exception has expired;
  - the advisory is no longer reported (remove the stale exception);
  - a newer release of the package than `maxVersion` is published (upgrade via `overrides`, then remove the exception);
  - the package's code appears in `.worker-build/worker.js` or `.output/public`.
- **Current exception:** **GHSA-fc5q-39xc-vjpf (picomatch ≤ 4.0.7)**, which has no patched release (advisory published 2026-10-19). Exposure is build and test tooling only (vite/vitest/tinyglobby/fdir, TanStack build plugins, typescript-eslint): no customer input reaches it, and it is verified absent from deployed artifacts on every run. Approved by the owner on 2026-11-17, **expires 2026-12-01**.
- **Unit tests:** in `src/test/security-audit.test.ts`.
