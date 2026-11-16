# Protected acceptance execution — 2026-11-14

The later owner directive authorizes first protected acceptance deployment, dedicated acceptance migrations, verified DB/MEDIA bindings, isolated restricted configuration and non-production hosted testing. Public DNS, live payments, real emails and sensitive owner-controlled security actions remain separate.

## Executed and verified

- Reconciled approved main 2942789a542fc3bf032699f06e6077b603810fc3 and its passing exact-main CI. Built and packaged from that exact commit, with original application/branding preserved.
- Revalidated the encrypted empty acceptance recovery artifact, private key permissions, authenticated decryption, SHA-256 and isolated restoration/all three migrations. No new export was made. Artifact/key remain outside Git with restricted custody; durable retention/custody remains an owner decision for production.
- Verified account b4e142fe9da84ef204eecda2efe4a730, existing Worker debc58162c864e1e8ded0d63bb8823b5, D1 afnan-collection-acceptance UUID 11950c2f-14bb-4a31-9add-356f155dea4e and private R2 afnan-product-media-acceptance.
- Applied approved migrations 0001_commerce.sql, 0002_admin_management.sql and 0003_administrator_mfa.sql to that acceptance D1 only. Recorded the standard d1_migrations ledger alongside each migration. Current ledger has all three entries, quick_check=ok and foreign_key_check is clean. Users/staff/orders/payments remain zero. No owner role or customer account was created. The encrypted pre-migration baseline and pre-migration recovery bookmark remain in restricted staging; no destructive rollback performed.
- Created Afnan-only Access application 00b0cf57-5c99-4fbd-83fd-b0c65bbbc5ce, covering the exact workers.dev hostname and the existing Worker destination. Its sole policy, 4ef44160-c693-444a-85ac-d895f7bd138b, denies everyone. No bypass, human Allow, service credential or shared IdP change exists.
- Build and actual-resource configuration dry-run passed (about 938 KiB compressed upload). DB/MEDIA/ASSETS binding identities are verified in the package. These bindings are not installed remotely because there is no uploaded version yet. Keep APP_ENV=acceptance, CHECKOUT_ENABLED=false, PAYMENT_MODE=disabled, EMAIL_SENDER_VERIFIED=false and no fixtures.
- Readback: zero Access service tokens, zero Worker versions, workers.dev/previews disabled, R2 managed public access disabled. Anonymous root and /admin probes return 404 while the Worker URL is disabled; this confirms no application is served, not a working Access challenge or application.

## Credential approval boundary

Automatic approval review rejected creating the proposed enabled Access service token and handling its client secret: it classified this as a persistent security/credential change not explicitly included in the deployment approval, which reserves sensitive security actions. No token was created and the action was not retried through another route. Deny-all protection is a safer closed configuration, not a substitute for authorized tester access.

The application also requires AUTH_SECRET before its primary session/administrator routes can operate. It is currently unavailable. No acceptance or production AUTH_SECRET was generated/installed merely to bypass this boundary. No real Resend key is available, and no real email was sent.

## Exact next approval package

Approve only the following acceptance-scoped credential operations, after reviewing this record:

1. Create **one** enabled Access service token named **Afnan acceptance automation**, valid **24 hours**, tagged only for Afnan acceptance. Store its one-time client secret using authenticated encryption in permission-restricted local storage outside Git. Do not log token values, grant account membership, grant application staff roles or disclose credentials in chat.
2. Change only Access app **00b0cf57-5c99-4fbd-83fd-b0c65bbbc5ce** from closed deny-all to **Service Auth** for that exact newly created token ID (`decision=non_identity`, `include=[{service_token:{token_id:created_id}}]`). No Everyone Allow, Any Service Token, Bypass, public override, new IdP or account-wide/MFA change. Unmatched requests remain denied. Retain both exact hostname and Worker destinations. Revoke the dedicated token when acceptance ends or it expires; do not delete Access protection while a hostname is active.
3. Generate one cryptographically random **acceptance-only AUTH_SECRET** (32 random bytes encoded as 64 hexadecimal characters) and install it as an encrypted Worker secret_text binding on this existing Worker's acceptance version. Keep any local recovery copy encrypted outside Git. Do not reuse another business's secret, create Resend credentials or install a live Paystack key. This server configuration does not verify an owner, enroll MFA or assign a role.
4. Then complete the already-authorized asset/version upload, DB/MEDIA/ASSETS bindings and protected activation. Enable only the Access-protected workers.dev acceptance entry after policy readback; keep previews and public-domain routes disabled. Verify missing/wrong credentials are denied and the authorized machine can reach the approved application before reporting hosted startup. Do not activate afnancollectionkn.com or change DNS.

This enables machine-hosted checks only. Owner identity/mailbox/WebAuthn/recovery must still be personally verified. Access headers or machine credentials never grant application staff privileges. No fixture-only OTP sink/payment adapter or first-admin bypass may be installed remotely. Privileged product/photo/inventory operations wait for approved owner provisioning and real authentication rather than manufacturing an active administrator.

## Current outcome and rollback

Acceptance D1 schema is installed and clean; closed Access protection exists; approved build/configuration is ready. Application deployment and hosted acceptance are **not complete**. No version, functional acceptance URL, hosted R2 upload, real email/MFA result or successful public launch is claimed.

Keep hostname/previews disabled and deny-all in place while credential approval is pending. The first application has no previous version to restore. Migration rollback is not automatic: prefer forward fixes; any destructive restore to the retained pre-migration recovery point requires its own authorization. Other businesses, public DNS and the Lovable website remain unchanged.

## Protected deployment — 2026-11-15 (Claude Code takeover)

Owner explicitly approved the credential package above "as written" on 2026-11-15, with deny-by-default preserved throughout. Claude Code took over from the interrupted Codex session. Codex had not stopped mid-upload: it stopped at the credential gate.

### Verified state found before acting

- Worker had zero versions and zero deployments; workers.dev and previews were disabled. D1 `11950c2f-…` was present with 28 tables, and `wrangler d1 migrations list --remote` reported **no migrations to apply**, so 0001–0003 were not repeated. R2 `afnan-product-media-acceptance` was present with managed r2.dev access disabled.
- Change since this record was first written: after 3a90449, a service token `ba3ec6f3-6da0-474d-a170-1f69016a0eca` ("Afnan acceptance automation") had been created with a **1-hour** duration (expires 2026-11-15T00:04:06Z), plus Service Auth policy `d4c4d7c0-5261-45d2-bd66-0cb34c203561` (precedence 2) referencing it. Deny-everyone policy `4ef44160-…` (precedence 1) was still in place. That token's one-time secret was never handed over, and it expired during the takeover.

### Executed

- Built exact approved commit `2942789a542fc3bf032699f06e6077b603810fc3` in a clean worktree using the frozen Bun lockfile. Typecheck passed, lint had 0 errors (10 baseline warnings) and 18/18 unit tests passed. The worker bundle was then built locally, and integration (85), acceptance (12) and security (77) assertions passed. These suites ran under Node 22 locally; the repo targets Node 24, which is what CI uses.
- Generated a 64-hex-character acceptance-only `AUTH_SECRET` and installed it in the same upload as `secret_text`. A recovery copy is kept AES-256-GCM encrypted outside Git, in session-scoped storage. Do not reuse it in production.
- Deployed **Worker version `0a2bfc57-2cdb-48ec-887b-552d53db6bf3`** (deployment `12522c9a-a894-4cd9-a557-8208767eb8f5`, 100%). Bindings were read back: DB → D1 `11950c2f-…`, MEDIA → `afnan-product-media-acceptance`, ASSETS, `APP_ENV=acceptance`, `APP_ORIGIN=https://afnan-collection-storefront.danwakili.workers.dev`, `CHECKOUT_ENABLED=false`, `PAYMENT_MODE=disabled`, `EMAIL_SENDER_VERIFIED=false`, `AUTH_SECRET` (secret_text). No `TEST_FIXTURES`, Resend or Paystack key.
- **Asset verification:** Wrangler hashed all 31 files in `.output/public` and reported "No updated asset files to upload". This means every asset hash in this build already existed for this Worker from the earlier upload; none was missing or different. Nothing was re-uploaded.
- With deny-everyone still at precedence 1, enabled **only** the workers.dev hostname. Previews remain disabled; there are no routes and no custom domain.

### Access-control results (unauthenticated, from outside)

- `/`, `/admin`, `/api/auth/get-session`, `/products`, `/index.html`, `/favicon.ico`, `/assets/`, `/?x=1` all return **302 to the Afnan Access login**; the app and assets are not served. (One `/` probe returned 404 in the seconds before the hostname went live.)
- Random service-token headers → **401**. The expired token's client ID with a wrong secret → **401**. A forged `Cf-Access-Jwt-Assertion` header and `CF_Authorization` cookie → **302 to login**.

### Blocked — not done

- **New service token not created.** The cloud session's network proxy refuses any request that creates, shows or changes a Cloudflare credential, even with owner approval. The request was not retried another way. Because no new token exists, the Service Auth policy was not repointed, deny-everyone was **not** removed, and the expired token was **not** deleted (policy `d4c4d7c0` still references it). The authorized-machine check and hosted functional tests (storefront render, owner sign-in/MFA, catalog, uploads, orders) have **not** been run against the hosted Worker. Hosted startup is shown only by the Access-protected deployment and the 71 ms startup check at upload, not by a served response.
- **Owner action to unblock:** in the Cloudflare dashboard (Zero Trust → Access → Service credentials), create one "Afnan acceptance automation" token valid 24h. Edit policy `d4c4d7c0` on app `00b0cf57` to include only that token, and delete expired token `ba3ec6f3`. Then give the operator session the client secret through the session's secure credential form for host `afnan-collection-storefront.danwakili.workers.dev` (header `CF-Access-Client-Secret`); never put it in chat or Git. The client ID is an identifier and can be passed directly. After authorized access is verified, remove deny-everyone `4ef44160` and recheck that requests without the token are still refused.

### Rollback

This is the first version, so there is no previous version to roll back to. To withdraw it, disable the workers.dev subdomain (`POST …/workers/scripts/afnan-collection-storefront/subdomain {"enabled":false}`). Access deny-everyone stays in place either way. There were no D1 writes in this step.

## Hosted acceptance — 2026-11-15, Worker version 0a2bfc57

### Access transition

- Owner created service token `8ead1dc6-a732-4e79-863c-51cd46ec6086` ("Afnan Automation", 24h, expires 2026-11-16T00:22:10Z) in the dashboard. Service Auth policy `d4c4d7c0` still referenced the expired token, so the operator repointed it (approved step 2) to include **only** `8ead1dc6`. Deny-everyone `4ef44160` (precedence 1) was untouched.
- The client secret was supplied by the owner through the session's secure credential form; the session proxy injects it for this hostname only. It never appeared in chat, logs or Git.
- With deny-everyone **still in place**, the new token reached `/` and `/admin` (200). Missing client ID → 401; old token's client ID → 401. Cloudflare evaluates Service Auth before Block, so deny-everyone does not block the authorized machine, but it does refuse everything else. **Decision: deny-everyone is retained.** Removing it would only reduce protection. Approval permitted removal but did not require it.
- Expired token `ba3ec6f3` is no longer referenced by either Access app in the account or by the reusable policy. Deleting it was refused by the session proxy (same credential-change rule as creation). Owner to delete it in the dashboard.

### Hosted results (live HTTPS through Access, response bodies checked) — 37/43 automated checks, 6 reviewed

Passed:
- 9 storefront pages server-render with the correct Afnan titles: `/`, `/shop`, `/about`, `/contact`, `/policies`, `/cart`, `/checkout`, `/account`, `/admin`.
- All 11 `/assets/*` files referenced by the homepage are served and are byte-identical to the build. favicon, robots.txt and the traced SVG are also served.
- `/api/health` → `{"status":"ok","checkoutEnabled":false,"paymentsEnabled":false}`.
- D1 reads live: `/api/business` (business record), `/api/categories` (seeded categories), `/api/store`/`/api/products`/`/api/zones` return empty. The catalog is empty, as expected before owner provisioning.
- No session is created for the machine credential. Admin APIs (`overview`, `products`, `orders`, `customers`, `media`, `admin-security/status`) → 401 "Sign in required". `/api/addresses` and anonymous `PATCH /api/profile` → 401.
- Acceptance-mode sign-up → 404. OTP request for an unknown `@example.com` identity gets a non-enumerating 200, and no email can be sent (sender unverified, no Resend key). A bogus OTP → 400.
- Order creation → 503 "Ordering is not enabled". Unsigned payment webhook → 503 "Payments are disabled".
- R2: an unknown media key → 404, and private admin media → 401.
- Security headers present: CSP (`frame-ancestors 'none'` …), nosniff, Referrer-Policy, HSTS, Permissions-Policy.

Reviewed, not defects (test assumptions): `/api/me`, `/api/cart` and `/api/orders` return null/empty for anonymous callers by design; the queries are owner-scoped and expose nothing. `/api/profile` is PATCH-only (GET 404). `X-Frame-Options` is absent, but CSP `frame-ancestors 'none'` covers it.

**Defect — launch blocker:** the authoritative logo `/brand/IMG_8842(1).png` returns **404 on the hosted Worker**, written literally or percent-encoded, although the file is in the build (SHA-256 d40111ef…) and the asset hashes are uploaded. The same request returns 200 under local `wrangler dev`. The homepage references this path 5 times (plus 3 absolute production URLs), so the hosted storefront shows a broken logo. The likely cause is the parentheses in the asset path on Cloudflare's hosted asset service. The proposed fix needs owner approval because AGENTS.md pins this path: publish the same bytes at a path without brackets (e.g. `/brand/afnan-collection-logo.png`), point `business.logoUrl` at it, update the branding test and docs, and redeploy as a new version.

Not run: owner email OTP, WebAuthn enrolment, recovery, staff role assignment, product/photo upload and publication, real orders. These need the owner's verified identity, and real email, which remains disabled.

## Logo-path correction — 2026-11-15 (owner-approved)

- Fix: draft PR #5, branch `fix/logo-path`, commit `93509da0f629f112276c26e601bd317b1b6bd633`, based on approved main `2942789`. Byte-preserving rename `public/brand/IMG_8842(1).png` → `public/brand/afnan-collection-logo.png`; SHA-256 `d40111ef…cdc1` unchanged. `business.logoUrl` and the branding test are updated, with a new guard against public paths that need URL encoding. AGENTS.md, the brand manifest, BRANDING.md and the README record the rename.
- Local verification on that commit: typecheck, lint (0 errors), unit 18, integration 85, acceptance 12, security 77, branding 88, browser 111, storefront 181, `bun audit` clean. The browser suites ran on Chromium build 1243 instead of the pinned 1254, under Node 22 (CI uses Node 24).
- **Deployment blocked from the Claude cloud session.** The fix changes 17 hashed JS chunks. Wrangler uploads new assets with a short-lived upload JWT in `Authorization`, and the session's credential proxy replaces that header with the stored API token, so `POST …/workers/assets/upload` → 401. No version was created; deployment `12522c9a` / version `0a2bfc57` remains at 100%. The first deploy succeeded only because every asset hash already existed. The proxy refuses header-override workarounds, and none was attempted. **This applies to any future change that alters client assets, not just this one.**

### Owner deploy (from a machine with direct Cloudflare access)

```sh
git clone https://github.com/Babaram977/Afnan-Collection-.git && cd Afnan-Collection-
git checkout 93509da0f629f112276c26e601bd317b1b6bd633
bun install --frozen-lockfile && bun run build
mkdir -p .wrangler/acceptance   # ignored by Git; contains no secrets
# Write .wrangler/acceptance/wrangler.jsonc with exactly the acceptance config below
CLOUDFLARE_ACCOUNT_ID=b4e142fe9da84ef204eecda2efe4a730 npx wrangler deploy \
  --config .wrangler/acceptance/wrangler.jsonc --message "Afnan acceptance: logo-path fix 93509da"
```

Acceptance config (paths relative to `.wrangler/acceptance/`). `workers_dev` is `true` because the protected workers.dev address is already enabled; setting it `false` would turn the address off.

```json
{
  "name": "afnan-collection-storefront",
  "account_id": "b4e142fe9da84ef204eecda2efe4a730",
  "main": "../../worker.ts",
  "compatibility_date": "2026-11-13",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "preview_urls": false,
  "routes": [],
  "assets": { "directory": "../../.output/public", "binding": "ASSETS", "run_worker_first": true },
  "observability": { "enabled": true, "traces": { "enabled": true } },
  "vars": {
    "APP_ENV": "acceptance",
    "APP_ORIGIN": "https://afnan-collection-storefront.danwakili.workers.dev",
    "CHECKOUT_ENABLED": "false",
    "PAYMENT_MODE": "disabled",
    "EMAIL_SENDER_VERIFIED": "false"
  },
  "d1_databases": [{ "binding": "DB", "database_name": "afnan-collection-acceptance", "database_id": "11950c2f-14bb-4a31-9add-356f155dea4e", "migrations_dir": "../../migrations" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "afnan-product-media-acceptance" }]
}
```

The existing `AUTH_SECRET` secret is kept across `wrangler deploy`; do not pass a secrets file. Do not run migrations. Do not change Access: the service-token policy and deny-everyone stay as they are. Rollback: `npx wrangler rollback 0a2bfc57-2cdb-48ec-887b-552d53db6bf3 --config .wrangler/acceptance/wrangler.jsonc`.

After deploying, the operator session re-runs the hosted checks: logo 200 with the matching SHA-256, desktop and mobile rendering, and the full hosted suite.

## Deployment pipeline — 2026-11-15 (owner-approved Option 2)

- Draft PR #6 (`ci/acceptance-deploy`, commit `51c492ccc7e913b9d59323a66cae4b54ef7e1f33`) adds a manual, owner-only `workflow_dispatch` deploy to the acceptance Worker, with secret-free build/test, an environment-gated deploy job, pinned Wrangler and actions, and a fixed target and bindings. Setup steps: `docs/engineering/ACCEPTANCE-DEPLOY-WORKFLOW.md` on that branch.
- The logo fix (#5, `93509da`) is **not yet deployed**; version `0a2bfc57` remains live. It is waiting on owner setup: merge #6, create environment `afnan-acceptance` with yourself as required reviewer, create a dedicated Workers Scripts:Edit token, add it as the environment secret, then dispatch with `93509da0f629f112276c26e601bd317b1b6bd633`.
- After that deploy, the operator session verifies the hosted logo returns 200 with SHA-256 `d40111ef…cdc1`, checks desktop and mobile rendering, and re-runs the hosted suite.

## Integrated acceptance release — 2026-11-15 (owner-authorized, acceptance only)

- **Merged to `main`:** #7 `b79981a` (hardened deploy workflow), #8 `c719bfd` (24-hour bank transfer), #5 `d0966b5` (logo, merge commit; `93509da` stays reachable), #9 `407347d` (receipts and payment review). CI on `main` at `407347d` passed (run #67).
- **Deploy protection test (owner):** deploy run #2 rejected at the required-reviewer gate; run #3 approved, deploying `93509da` as version `2ca5f17b` with the hardened workflow and a replacement token. Revocation of the previous token is **not yet confirmed**: the operator session cannot read Cloudflare tokens.
- **Migrations 0004 and 0005**, applied 14:35:27Z to acceptance D1 `11950c2f-…` only:
  - Preflight: matched the approval package (checksums, pending list, empty data, integrity). Pre-apply bookmark: `00000019-00000000-00005124-5cb889cd9d0aa07d830a15da88649d0f`.
  - After applying: ledger 0001–0005; `quick_check` ok; foreign-key check empty; all 11 new objects present; no data changes; post-apply bookmark `00000019-00000004-00005124-bdc1af2e72e951df2d4db0dfd5daed52`.
- **Deployment:** run #4, owner-approved, conclusion success. Live version **`bee7b6a8-5bde-4cc6-992c-2b9a86722881`** (deployment `41d74f47-4e92-4ca3-9259-4b2d4502b8b3`, 14:47:38Z), commit `407347d`.
  - Bindings: acceptance variables; `CHECKOUT_ENABLED=false`; `PAYMENT_MODE=disabled`; `EMAIL_SENDER_VERIFIED=false`; `AUTH_SECRET`; D1; MEDIA; RECEIPTS (private). Previews off; no routes.
  - Rollback target: `2ca5f17b` (code-only; the schema can stay).
- **Hosted checks:**
  - Without the token, every path returns 401, including a forged JWT or cookie.
  - With the token: health reports checkout and payments false; D1 reads work; the logo returns 200 with SHA-256 `d40111ef…`, and the homepage has no old-path references.
  - Order creation → 503; payment webhook → 503; pay or receipt on an unknown order → 404.
  - Admin review, receipt view and approval → 401 without an admin session. `/media` does not serve receipts. Acceptance sign-up → 404. Security headers are present.
  - D1 was unchanged by these checks.
- **Not done (separate approvals):** enabling acceptance checkout, test zone and product, and the payment workflow tests; Moniepoint account-name verification; email sender verification; production.

## Stage A controlled acceptance testing — closed 2026-11-16 (acceptance only)

- **Test catalog:** fictional zone `ACCEPTANCE TEST — Kano` and product `ACCEPTANCE TEST — not for sale` (₦2,500, stock 5) seeded with reviewed SQL. Checkout was enabled through the new workflow input (PR #10, `6bfa8b1`) in run #5 (`b1512a07`); `PAYMENT_MODE` stayed `disabled`.
- **53/53 hosted checks passed:** order, deadline and total; stock reservation; idempotency; oversell 20/20; receipts, validation, private storage and privacy; expiry and late receipt; cancellation; stock and ledger consistency; D1 integrity. One test-harness defect was fixed (no application failures).
- **Restored:** run #6 deployed version **`c515b292-40b6-4443-a01a-459e7f5dfa5e`** (01:00:44Z) with `CHECKOUT_ENABLED=false`, `PAYMENT_MODE=disabled`. The test catalog is hidden (non-destructive); 24 test orders, 6 private receipts and the audit trail are preserved; stock reconciled at 5.
- **Previous GitHub deploy token revoked** (owner; read-back confirmed). The Access service token expired at 2026-11-16T00:22Z, so Access currently refuses all requests until a new token is issued.
- Full results: `docs/engineering/acceptance/ACCEPTANCE-TEST-PLAN.md` on `docs/acceptance-test-plan`.
