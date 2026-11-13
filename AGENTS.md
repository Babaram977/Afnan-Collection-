# Afnan Collection Online — maintenance instructions

## Ownership and scope

- GitHub is the authoritative source. The Lovable source was uploaded once; automatic synchronization is not configured. Do not assume commits flow to or from Lovable.
- Codex handles reviewed implementation; use Lovable for targeted design proposals, then review and apply their diffs against current GitHub state.
- Preserve published history with additive commits. Do not edit generated files such as src/routeTree.gen.ts by hand.
- Preserve the storefront and docs/design/AFNAN-UI-STANDARD.md. No redesign is authorized by initialization.
- The master execution instruction authorizes functional commerce and authenticated administration against local/test backends. Keep CHECKOUT_ENABLED=false and PAYMENT_MODE=disabled in checked-in runtime defaults; live orders and live payments remain unauthorized.
- Do not merge, publicly deploy, change production DNS, activate live payments or execute destructive production migrations. Local/non-production fixture migrations are authorized. The owner subsequently approved acceptance storage creation: afnan-collection-acceptance D1 and afnan-product-media-acceptance R2 now exist. Worker creation/deployment, remote migrations, secrets and administrator assignment remain separate gates.
- Keep secrets and customer information out of Git and continuity records, regardless of repository visibility. Use hosting secret storage for future server credentials; VITE_* values are public.
- The previous generic Lovable-managed database/secrets/synchronization instructions are superseded by this owner-authorized GitHub handoff. The commerce backend uses D1 and Better Auth; Paystack is the sole authorized payment provider, with live keys deliberately rejected.

## Durable project continuity

- Before development, read all five files in docs/project-continuity/ and reconcile them with current branches, PRs, reviews and exact-head CI.
- Update relevant records alongside meaningful implementation milestones. Preserve earlier decisions and record changes with reasons; distinguish verified facts, proposals and unresolved questions.
- Recover lost conversation context from these records and GitHub history. Keep each project's records separate.
- Do not create unnecessary commits, merge or deploy solely to maintain records.

## Validation

- Use the committed Bun lockfile for reproducible installs: bun install --frozen-lockfile. Do not introduce a competing lockfile casually.
- Run tests, TypeScript checking, lint and production build as appropriate; record failures honestly. Do not bulk-format the existing storefront to clean up unrelated baseline lint findings.
- vite.config.ts wraps framework plugins already supplied by @lovable.dev/vite-tanstack-config; do not duplicate them or externalize Worker runtime dependencies.

## Project rules

- Catalog reads use src/lib/catalog.ts through TanStack server functions and D1. Pass runtime bindings with the current request; never retain customer/request state in module-global variables.
- Money is integer kobo formatted with `formatNaira` — avoids float errors and keeps NGN display consistent.
- Cart is a browser preview plus an owner-scoped D1 copy. Server prices and transactional stock checks are authoritative; never trust browser prices or a payment redirect.
- UI contract documented in `docs/design/AFNAN-UI-STANDARD.md`; update it with any route/token/API change.

## Business identity

- src/lib/business.ts is the single source for the owner-supplied address, WhatsApp, socials, CAC and TIN. CAC/TIN are supplied, not independently verified; show them only in business/legal sections.
- Read `docs/design/AFNAN-BRAND-ASSET.json` and `docs/engineering/BRANDING.md` as durable project brand memory before logo or marketing work. The supplied gold AC/black flourish logo is authoritative. Never redraw or substitute a generated logo. Use the verified original at `public/brand/IMG_8842(1).png` (SHA-256 `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`), referenced centrally by business.logoUrl. Preserve its bytes and proportions; never substitute the reference trace. Run `bun run test:branding` for logo changes.
- Preserve warm cream, cocoa, terracotta and pastel tokens and Fraunces/Nunito Sans. Read the updated UI standard before changing presentation.

## Security-critical invariants

- All administrative APIs enforce database-backed staff roles. There is no public first-admin bootstrap route. The bootstrap script is local-only and requires an already verified account.
- Reserve stock and create order snapshots in one D1 batch; the SQL trigger/constraints must reject stock races and restore cancelled/expired holds once. Refunds never automatically restock uninspected goods.
- Never trust a browser callback. Verify Paystack signatures over the original body and re-query provider amount/currency/reference/status. Deduplicate events and route late payments to review.
- TEST_FIXTURES requires APP_ENV=test and localhost origin; never configure this on a remote Worker. Test mail/payment tables exist only in tests/fixtures.sql.
- Run clean frozen install, typecheck, lint, unit tests, worker build/dry-run, Worker/D1 integration tests and responsive/browser accessibility tests for meaningful commerce changes. No real email or payment call is needed for fixture tests.

## Protected acceptance review

- Read docs/engineering/acceptance/GATE-2-REVIEW.md before any remote operation. Current scope is owner only; admin@afnancollectionkn.com and orders@afnancollectionkn.com are supplied settings, not verified identities. Gate 3 writes/deployment/email/DNS remain unapproved.
- Preserve acceptance-mode signup denial. Pre-provisioning a named identity and assigning staff are separate approved, audited actions after verification. Never enable fixtures remotely. Run test:acceptance alongside integration/browser/branding checks.
