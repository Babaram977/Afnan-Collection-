# Afnan controlled acceptance runbook

Latest readiness refresh: [Gate 3 approval package](acceptance/GATE-3-APPROVAL.md). The existing Zero Trust team and Cloudflare IdP are active; no enrollment needed. MFA and Afnan-only policies are not configured. Separate deployment, sender DNS and real-email approvals; no remote execution authorized.

Current Gate 2 review: [acceptance/GATE-2-REVIEW.md](acceptance/GATE-2-REVIEW.md). Owner-only identities, MFA and sender verification requirements there supersede earlier general tester/self-registration procedures. This phase performs no remote writes; all Gate 3 actions remain unapproved.

Prepared 2026-11-13 (Africa/Lagos). This is a procedure for review, not authorization to run remote commands. Continue draft PR #2 on feat/commerce-platform. Source baseline is 31d26811206050dbbf399dc24d6afa113a8bf70f; no later upstream commit existed at reconciliation. Original PNG checksum remains verified. No application redesign or backend replacement is needed.

## 2026-11-13 — owner-approved acceptance storage creation

Owner explicitly approved creation of the named acceptance D1 and R2 only, following the clarification that Worker upload/deployment remains separate. Created afnan-collection-acceptance (DB) and afnan-product-media-acceptance (MEDIA, Standard) in the verified account. GET confirms D1 has zero tables; no migrations or customer data were added. R2 public r2.dev access is disabled and no custom domains exist. Creation succeeded without subscription or billing-setting changes, proving D1/R2 creation permission for these resources. Default placements returned WEUR for D1 and EEUR for R2; no jurisdiction restriction was requested.

Worker afnan-collection-storefront remains planned, not created or reserved. The same six existing Workers retain their pre-action modification timestamps. No deployment, secrets, role assignments, email setup, DNS, production infrastructure or checkout/payment changes occurred. Resource IDs are retained in ignored protected local operator records, not public documentation. Next gates are separately authorized migrations, protected origin/testers, secure email/auth configuration, owner role assignment and controlled Worker upload/deployment; sandbox checkout remains separate.

Application source remains unchanged from the validated 8439b70 baseline (both CI runs 43445561177 and 43445552543 passed). This milestone changes documentation only; verification used actual create responses plus GET resource/public-access/Worker inventory readback. Historical “not provisioned” statements below describe earlier stages and are superseded for these two acceptance resources only.

## Verified account reconciliation

The owner-supplied account and zone IDs were explicitly used for GET requests. Account name and IDs remain in the protected handoff rather than this public repository. The connection now reaches the intended Yahoo account, unlike the earlier Gmail-account inventory. Earlier claims of missing zone access and disabled R2 are superseded for this account.

- Zone afnancollectionkn.com: active, full, not paused; returned account matches the owner-supplied account.
- Six existing scripts: dripplex-customer-web, dripplex-merchant, dripplex-ops, dripplex-rider, heroine-collection-storefront, landonova-genesis-core. No Afnan script. Listing metadata only; no settings or code changed.
- D1 GET succeeded, zero databases. D1 is accessible; creation/quota enforcement was not exercised.
- R2 GET succeeded: dripplex-public and dripplex-uploads. No Afnan bucket. The latest result differs from the owner's earlier empty list; do not borrow either bucket.
- Zone permission metadata reports worker edit, D1 edit and R2 bucket edit. API creation requires Workers Scripts Write, D1 Write and Workers R2 Storage Write respectively. Reported permission metadata and working reads support readiness but are not successful creation evidence.
- Subscription GET failed HTTP 403/code 10000. The connector explains that OAuth cannot cover this endpoint; an account-owned token with Billing Read or an owner Dashboard review is required. This is a billing-specific limitation, not a failed Cloudflare session. Workers account-settings GET succeeded with default_usage_model=standard; that does not prove the paid subscription.

R2 is accessible and already hosts buckets. No enablement or billing change is currently justified. The remaining entitlement check is owner confirmation of the active R2 subscription/payment status and permitted new-bucket usage. No non-mutating bucket-creation dry-run was found in the inspected API/CLI. Only an explicitly approved create attempt can prove write entitlement/quota; stop on an error instead of enabling billing automatically.

## Exact resources and isolation

| Resource | Name | Binding | Initial content |
| --- | --- | --- | --- |
| Worker | afnan-collection-storefront | ASSETS for bundled static files | Reviewed Afnan application only |
| D1 | afnan-collection-acceptance | DB | Reviewed schema; no production/customer import |
| R2 Standard | afnan-product-media-acceptance | MEDIA | Owner-approved test product photographs only |

One Worker only, with dedicated acceptance storage. Acceptance and later production are separate reviewed stages; never replace bindings with Heroine, DrippleX or Landonova resources. No production resources are created now. DNS records, apex/www, Lovable routing and all existing services stay untouched. Future production storage proposals remain afnan-collection-production and afnan-product-media-production.

## Cost and limit review before approval

Pricing checked against official documentation on the evidence date; USD, taxes and account agreements may differ. Included usage is account-wide and shared with the six services, not a fresh Afnan allowance. Owner must review actual remaining usage and approve a budget/alert recipient before creation.

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/): Free has 100,000 requests/day and limited CPU (10 ms/request). Paid starts at $5/account/month, includes 10 million requests and 30 million CPU-ms/month; overage $0.30/million requests and $0.02/million CPU-ms. SSR/auth must be measured on the selected plan. Do not infer a paid plan from zone Free Website or standard usage model. Current run_worker_first invokes the Worker for assets too; do not assume every asset fetch avoids compute billing.
- [D1](https://developers.cloudflare.com/d1/platform/pricing/): Free includes 5 million rows read/day, 100,000 written/day and 5 GB total; 10 databases. Paid includes 25 billion reads/month, 50 million writes/month and 5 GB; overages $0.001/million reads, $1/million writes and $0.75/GB-month. [Limits](https://developers.cloudflare.com/d1/platform/limits/) and plan-specific per-database size/recovery retention must be checked in the account before migrations and backups.
- [R2 Standard](https://developers.cloudflare.com/r2/pricing/): free tier 10 GB-month, 1 million Class A and 10 million Class B operations/month. Beyond included usage: $0.015/GB-month, $4.50/million Class A, $0.36/million Class B; Internet egress free. First 100,000 buckets included; extra buckets $0.10/month each under current pricing. Two listed buckets do not imply all other quotas/billing are clear. Do not enable Infrequent Access, Catalog or extra services.
- Access identity/seats and transactional email have separate plan/usage limits. Review those with the owner. Propose bounded acceptance: at most 10 test products, 100 images/100 MB and named testers, with daily cost/error review. These are operating limits, not platform-enforced spend caps. Agree a dollar ceiling before approval; stop tests on unexpected usage.

## Provisioning procedure — run only after specific owner approval

Prerequisites: approved account/budget, exact three names, protected origin/protection plan, region/residency choice, dedicated credential scope and reviewed source/CI. No permission to run the following commands is granted by this document. Use project-local Wrangler 4.160.0 (installed help inspected), Bun 1.4.4 and Node 24. Set CLOUDFLARE_ACCOUNT_ID from the protected handoff; never rely on the default account or put tokens in command arguments/chat. A narrowly scoped account-owned operator credential must be configured securely. GET inventory immediately before creation; if a proposed name exists, inspect ownership and stop rather than overwrite.

After approval for resource creation only:

```sh
node node_modules/wrangler/bin/wrangler.js d1 create afnan-collection-acceptance --update-config=false
node node_modules/wrangler/bin/wrangler.js r2 bucket create afnan-product-media-acceptance --storage-class Standard --update-config=false
```

No automatic config rewriting or automatic provisioning. Capture returned D1 UUID and bucket metadata in protected operator records. Do not run against the top-level development DB. Check GET details of the new resources against the approved account/names. A Worker is created by its first upload/deployment; there is no need to deploy an empty placeholder to reserve its name. Worker creation/upload awaits the separate controlled deployment approval.

Prepare this **local, ignored** file at `.wrangler/acceptance/wrangler.jsonc`, after substituting all REQUIRED values. Paths are relative to that file. It is a review template, not a committed deployable config; missing IDs must never be omitted to trigger automatic provisioning.

```json
{
  "name": "afnan-collection-storefront",
  "account_id": "REQUIRED_OWNER_ACCOUNT_ID",
  "main": "../../worker.ts",
  "compatibility_date": "2026-11-13",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "preview_urls": false,
  "routes": [],
  "assets": {"directory": "../../.output/public", "binding": "ASSETS", "run_worker_first": true},
  "observability": {"enabled": true, "traces": {"enabled": true}},
  "vars": {
    "APP_ENV": "acceptance",
    "APP_ORIGIN": "REQUIRED_APPROVED_HTTPS_ORIGIN",
    "CHECKOUT_ENABLED": "false",
    "PAYMENT_MODE": "disabled"
  },
  "d1_databases": [{"binding": "DB", "database_name": "afnan-collection-acceptance", "database_id": "REQUIRED_RETURNED_D1_UUID", "migrations_dir": "../../migrations"}],
  "r2_buckets": [{"binding": "MEDIA", "bucket_name": "afnan-product-media-acceptance"}]
}
```

Keep all secrets out of this file. No TEST_FIXTURES remotely. Top-level wrangler.jsonc remains local-only with placeholders. Explicitly use the reviewed acceptance config on every future command; do not use generated Nitro config or `nitro deploy` as a shortcut. Build with the existing worker:build script, then package the intended config with `node node_modules/wrangler/bin/wrangler.js deploy --config .wrangler/acceptance/wrangler.jsonc --dry-run --outdir .wrangler/acceptance/package`. Inspect bindings and target before any upload. Dry-run is local evidence only.

## Migrations, identity and email

After separate approval for forward migrations on the new acceptance D1:

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations list DB --config .wrangler/acceptance/wrangler.jsonc --remote
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --config .wrangler/acceptance/wrangler.jsonc --remote
node node_modules/wrangler/bin/wrangler.js d1 migrations list DB --config .wrangler/acceptance/wrangler.jsonc --remote
```

Review both files first: 0001_commerce.sql and 0002_admin_management.sql. Verify returned database UUID, migration ledger and expected tables; second apply should have no pending changes. Never apply tests/fixtures.sql remotely or copy the local test database. CLI may skip confirmation in noninteractive mode, so authorization must precede invocation.

Missing owner configuration: chosen administrator email and independent business-ownership confirmation; named test users; verified Resend sender/EMAIL_FROM and securely configured RESEND_API_KEY; random AUTH_SECRET of at least 32 bytes; exact HTTPS APP_ORIGIN. Never request secret values in chat. Existing admin:bootstrap script is deliberately local-only: do not change its flag to remote or assume it provisions remote staff.

After approved protected deployment and real email delivery, owner signs in and verifies the code. An authorized operator must inspect the verified user ID and email in acceptance D1, confirm ownership separately and execute a reviewed parameterized staff INSERT for that exact user ID/role through an account-owned procedure. Re-read the assigned role. No public bootstrap or first-signup-admin route. Revoke the staff row on offboarding and revoke sessions; do not expose database results/customer identifiers in PRs.

Test actual email receipt, five-minute expiry, five-attempt limit, replay/recovery/session revocation and Secure cookies over HTTPS. The current in-memory auth limiter is per Worker instance, so outer Access allowlisting and monitoring are required during acceptance; review distributed abuse protection before production. Missing sender DNS verification requires a separate DNS approval; no invented business mailbox.

## Protected deployment and acceptance sequence

1. Owner approves named testers, exact origin and protection. Prefer Afnan-only workers.dev Access protection to avoid production-zone DNS changes. Confirm the account's existing workers.dev subdomain read-only. Preconfigure a deny-by-default application/policy for the exact Afnan hostname; permit named testers only. Do not change account-wide Access policies covering other services. Access is an outer gate, not a replacement for Better Auth or staff roles.
2. Review the supported [workers.dev protection](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev). Keep preview URLs disabled; cover every alternate origin. If the selected plan cannot protect workers.dev before exposure, stop and review an approved alternative. A custom acceptance hostname and any required DNS/TLS changes need separate authorization. No unprotected/public deployment as a temporary workaround.
3. After explicit protected-deployment/secret-configuration approval, upload the reviewed Afnan build with dedicated DB/MEDIA. Keep workers_dev false until the exact-host policy is in place and reviewed; then enable only that protected endpoint in the local acceptance config. No apex/www routes. Set secrets using protected interactive input/staged version workflow. Ordinary secret put/delete can deploy immediately. Keep checkout false and payments disabled.
4. Validate from outside: anonymous/unauthorized users denied before app/assets/API; allowlisted tester reaches application; direct alternate origins/preview URLs cannot bypass protection. Check actual version/bindings, HTTPS, redacted logs and original PNG checksum. Stop and block traffic on any isolation failure.
5. Test owner OTP sign-in/authorized role assignment, customer/fulfilment denial of admin operations, actual multipart image uploads and private draft previews, main-photo selection, genuine draft options/prices/opening stock, publication and catalog visibility. Reload/restart and confirm D1 inventory/media persistence; record test adjustments. Use owner-approved test identities and addresses only; no real customer imports or transactions.
6. Only after separate test-checkout approval: securely install Paystack TEST key, explicitly enable isolated test checkout/PAYMENT_MODE=test, and review how real signed Paystack webhooks reach the protected endpoint. Paystack cannot answer an interactive Access challenge: any narrowly scoped webhook exception must be explicitly approved, with raw-body signature and server verification enforced. Never bypass protection for the full API. Test duplicate/mismatched/late events, cancellation, full refunds and reconciliation. Live keys remain rejected. Return checkout to false/payments disabled after testing.
7. Record exact commit, Worker version, resource IDs privately, schema ledger, test evidence and failures. Review genuine catalog/policies/retention/backups/monitoring and owner acceptance before proposing production.

## Rollback and later production rollout

Before changes, record Afnan Worker version (if one exists), bindings, migration ledger, assets checksum and approved D1 export/Time Travel recovery point. Back up only Afnan acceptance objects to an owner-controlled destination; protect identity records outside Git. D1 recovery retention depends on account plan. Restore-test in an explicitly approved isolated target before claiming backup readiness.

If acceptance fails, deny access/stop test writes first. Restore the prior compatible Afnan version using `node node_modules/wrangler/bin/wrangler.js rollback APPROVED_VERSION_ID --config .wrangler/acceptance/wrangler.jsonc` only with rollback authorization. First deployment has no previous Afnan version: keep its endpoint disabled and investigate. Code rollback never restores D1/R2; avoid down migrations and use forward fixes. Data restoration or deletion of test resources requires explicit approval; never delete the existing buckets/services as cleanup.

Production sequence after documented acceptance: owner approves merge separately; provision separately approved production D1/R2; review new secrets, verified staff, real catalog/inventory, policies, recovery drill and spend alerts; apply reviewed production migrations; approve production deployment; snapshot current Lovable DNS/TLS/routing and rollback values read-only; approve a cutover window/apex-www decision; then change only authorized Afnan routes. Validate externally and retain the rollback window. Enabling real orders/live payments needs a separate code/security/business review and approval; current application rejects live payment keys. No production action is authorized by acceptance approval.

## Approval boundaries

Owner must explicitly approve (1) account billing/plan and budget, with any subscription change separately stated; (2) creation of the exact acceptance D1/R2 and forward migrations; (3) protected origin, named testers, Access policy, Worker upload/deployment and secure secret writes; (4) verified administrator role assignment and real-email test; (5) Paystack sandbox checkout/webhook exception when ready. Production resources, merge, deployment, DNS and live commerce each remain separate approvals. Do not request a generic reconnection: billing needs owner Dashboard review or a scoped Billing Read token only if programmatic inspection is desired.
