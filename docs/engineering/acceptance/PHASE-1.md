# Protected acceptance preparation — Phase 1

Evidence: 2026-11-13, Africa/Lagos. Baseline e9350d1, with both prior exact-head CI runs passing. This phase prepares local files and source changes only. No remote migrations, Access writes, secrets or deployments are authorized.

## Resource and origin verification

Read-only GET confirmed the intended account's D1 afnan-collection-acceptance (zero tables), R2 afnan-product-media-acceptance (Standard, EEUR, managed public access disabled) and existing workers.dev subdomain danwakili. D1 runs in WEUR. Actual resource IDs remain in `.wrangler/acceptance/resource-record.json` and the complete `.wrangler/acceptance/wrangler.jsonc`, both ignored with private local permissions. Do not confuse D1's API field `version: production` with application deployment: this acceptance database is still empty and the Worker is absent.

Prepared HTTPS origin: `https://afnan-collection-storefront.danwakili.workers.dev`. This is a proposed endpoint, not a deployed/live URL. It uses the existing account subdomain; no production-zone DNS or Lovable routing change is needed. Owner must approve this origin before Phase 2. No preview aliases or custom domains are proposed.

The actual local configuration binds DB to the verified acceptance D1 UUID, MEDIA to the dedicated private bucket and ASSETS to the existing built storefront. It sets APP_ENV=acceptance, APP_ORIGIN to the proposed HTTPS origin, CHECKOUT_ENABLED=false and PAYMENT_MODE=disabled. workers_dev=false, preview_urls=false and routes=[] keep every route off during preparation. There are no secrets or TEST_FIXTURES in it. The approved operator can inspect this complete file locally; after workspace loss recreate it from the runbook template and read-only resource identity verification rather than inventing IDs.

## Access blocker and prepared policies

The earlier GET not_enabled response is superseded: refreshed inspection confirms the active existing team falling-poetry-120a.cloudflareaccess.com and Cloudflare IdP, with no applications/policies. No enrollment is needed. Independent MFA and the owner-only application still require separate configuration approval; see GATE-3-APPROVAL.md. No Access setting was changed.

[access-plan.json](access-plan.json) contains reviewed reusable policy bodies and three exact-host application bodies. Owner subsequently selected admin@afnancollectionkn.com and owner-only testing. The selected identity is not verified or provisioned. See GATE-2-REVIEW.md for current identity/MFA/email and Gate 3 requirements.

- Root application: allow only the independently verified owner; default deny everyone else. No tester policy.
- More-specific `/admin` and `/api/admin` applications: owner only. No additional testers or customer accounts are permitted.
- One-hour Access sessions, HttpOnly cookie. Better Auth's seven-day application session remains independent: Access expiry must block further traffic even with a valid app cookie. Validate both layers and revocation before declaring acceptance successful.
- No bypass, service-token exemption, whole-domain allowance, account-member allowance or Paystack exception. Checkout/payments stay disabled. No account-wide policies or shared policies may be altered.

Phase 2 creates reusable policies through `/access/policies` first and attaches returned IDs to new Afnan-only applications. More-specific paths replace inherited root policies; test slash variants, descendant routes and direct APIs. See [application path precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) and [Workers Access](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev). Confirm exact-host workers.dev enforcement for the selected Access setup before enabling its route; if that cannot be established, stop rather than expose a temporary unprotected endpoint. Preview URLs remain disabled. Verify anonymous, wrong-email and named-tester admin denial externally during Phase 2, with Access logs; no local test can establish live edge enforcement.

## Registration and administrator bootstrap

Review found emailOTP previously created new users on first sign-in. Acceptance now explicitly disables OTP signup and the core `/sign-up/email` endpoint. Unknown email requests return a non-enumerating success without delivery or account creation. This lock applies whenever APP_ENV=acceptance; fixture flags cannot enable signup in that environment. Existing customer-registration behavior in local fixture/development flows is preserved. This is a backend guard, independent of whether a login form is visible.

Because self-registration is locked, an approved operator must pre-create only named acceptance identities using a separately reviewed parameterized database procedure, initially unverified and without staff privileges. After real email-code ownership verification, independently verify business ownership and assign the owner admin role to the exact verified user ID; testers receive no staff role. This supersedes the earlier runbook assumption that the owner could first self-register. Do not run the local-only admin:bootstrap script against a remote DB. No identity or staff row is created in Phase 1.

## Secret and sender inventory

| Setting | Requirement before Phase 2 use | Handling |
| --- | --- | --- |
| AUTH_SECRET | At least 32 random bytes, unique to Afnan acceptance | Protected secret storage; never Git/chat/CLI argument/log |
| RESEND_API_KEY | Approved transactional email account and permitted sender | Protected Worker secret; no provider switch |
| EMAIL_FROM | Owner-supplied verified sender, exact name/address | Protected configuration; no invented mailbox |
| APP_ORIGIN | Owner-approved exact HTTPS acceptance origin | Non-secret local acceptance config |
| PAYSTACK_SECRET_KEY | Omit in this phase | No checkout/payment approval; live keys rejected |
| Access organization/IdP | Owner-approved organization setup and verified login method | Do not assume an existing organization or IdP |

The production domain being active does not prove an email sender is verified. Any sender-verification DNS change needs separate approval; keep existing records untouched. Do not send mail during this phase. Ordinary Worker secret put/delete can deploy a new version: Phase 2 must use a reviewed staging/input workflow and verify the intended Worker before any write. No shared secret or credentials from other businesses.

## Migration review and rollback

Reviewed 0001_commerce.sql and 0002_admin_management.sql as ordered, forward-only migrations. Their SHA-256 values are recorded in migration-review.json. They contain schema, stock invariants and approved category labels only: no real customers, staff, merchandise, credentials or other-business resource references. 0002 adds soft deletion, promotional-price constraints/settings and replaces the reservation trigger so server effective price/deleted state remains authoritative. D1 batches and triggers protect reservation races and cancellation/expiry restores; existing runtime tests exercise these paths.

Raw migration SQL is deliberately not idempotent: replaying CREATE TABLE or ALTER TABLE directly fails. Repeatability comes from Wrangler's d1_migrations ledger; apply 0001 then 0002 through the migration runner, then repeat apply and confirm no pending migrations. Phase 1 tests this on local storage only, explicitly passing --local even though the config contains the real UUID. No remote ledger/schema exists yet. Foreign key checks and a local ledger readback must pass. Do not manually mark a failed migration applied; CLI rolls back the failed migration while retaining earlier successful ones. Preserve migration files once used remotely.

Rollback is not DROP TABLE/down SQL. Before Phase 2, confirm target account/UUID and empty DB, capture an approved export/recovery point, review plan-specific Time Travel retention and record the schema ledger. On failure stop writes, inspect the ledger and use a forward fix; any data restore/recreation needs approval. Worker version rollback does not revert D1 or R2. First deployment has no prior Afnan version, so the containment action is to keep its route disabled. Never reset another project's resources or copy local fixture tables into acceptance.

## Phase 2 inputs and approval scope

Owner selected admin@afnancollectionkn.com, owner only, and orders@afnancollectionkn.com. Still needed: mailbox/business ownership verification; approval of the proposed hostname; Access enablement/plan/IdP choice; approved verified EMAIL_FROM/Resend account; secure credential availability (not values in chat); recovery/monitoring operator and acceptable resource limits.

After these are reviewed, request explicit Gate 3 approval (Phase 2 execution) covering acceptance-only migrations, Access organization enablement and Afnan-only policies, secure secret setup, named identity provisioning/verified admin assignment and protected Worker deployment. Validate denial before admitting testers, then real email, owner operations/image persistence, session expiry/recovery and logs/rollback readiness. Keep checkout false, payments disabled and PR #2 draft. No production DNS, Lovable replacement, merge or live-commerce authorization is implied.
