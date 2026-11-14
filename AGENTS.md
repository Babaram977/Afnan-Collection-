# Afnan Collection Online — maintenance instructions

## Ownership and scope

- GitHub is the authoritative source. The Lovable source was uploaded once; automatic synchronization is not configured. Do not assume commits flow to or from Lovable.
- Owner workflow: Lovable for design and development; GitHub/Codex for code improvements and testing; Cloudflare Workers, D1 and R2 for hosting/infrastructure. Reconcile Lovable changes manually against current GitHub state.
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

## Owner-provided verifier nomination and launch boundary

- Aisha Idris Muhammad (owner’s wife) is nominated for independent owner-identity confirmation during sensitive enrollment/recovery. Nomination is not completed verification, willingness or consent. She receives no infrastructure/application/admin permissions. The existing authorized Cloudflare account administrator remains the separate recovery operator. Consult OWNER-IDENTITY-MFA.md and identity-mfa-record.json.
- Do not invite the owner into the shared Cloudflare account. The dedicated Afnan email-PIN IdP is preferred for further review, not approved implementation; preserve the shared IdP.
- Owner reports Afnan and Heroine are separate pre-launch businesses with official domains not yet connected to their storefronts. Connect official domains only after launch readiness and explicit approval; existing zone activation does not imply application-domain connection. Do not modify other businesses.

## Latest Worker provisioning result

- Owner later authorized dedicated Worker deployment from merged main, within explicit restrictions. PR #2 was merged externally; main cef6e6e is the verified source. afnan-collection-storefront now exists as an undeployed metadata-only Worker with workers.dev/previews disabled. Do not create a duplicate or infer a functioning application. Read docs/engineering/WORKER-PROVISIONING-STATUS.md before proceeding.
- Existing IdP cannot authenticate the selected owner under member-only restriction; current task forbids IdP changes and prior direction forbids shared-account invitations. Access/MFA and secure Resend sender setup remain unresolved. Preserve the unexposed Worker until these blockers can be resolved within authorization.

## Isolated application administrator MFA

- The later implementation directive selects an extension of Better Auth email sessions with mandatory WebAuthn, independent of shared account membership. Read docs/engineering/ADMIN-AUTH-ADR.md and ADMIN-RECOVERY-RUNBOOK.md; old email-PIN IdP plans are historical alternatives, not approved remote changes. Preserve pending/active/recovery/disabled state, exact-owner bootstrap and independent human verification.
- Every privileged operation requires current D1 staff role, verified primary email session and a current WebAuthn proof bound to user/session/epoch/role. Never add a test-mode MFA bypass. Run test:security plus all existing suites for authentication/authorization changes. Fixtures must perform real local signature verification.
- Production registration, checkout and payments remain disabled. Sender-verification flags and tests do not establish actual Resend/owner/device verification. No remote security/migration/secret/deployment/email/DNS operations until the owner's action-specific gates pass.
