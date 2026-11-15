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
