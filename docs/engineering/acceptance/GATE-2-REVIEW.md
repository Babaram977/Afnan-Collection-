# Gate 2 pre-deployment review

Latest identity/MFA and recovery record: [OWNER-IDENTITY-MFA.md](OWNER-IDENTITY-MFA.md). Exact owner account membership is absent under the current member-only Cloudflare IdP; enrollment/challenges and all remote writes remain unapproved.

2026-11-13, Africa/Lagos. This review incorporates Phase 1 preparation and the owner's subsequent settings. Stop at Gate 3. No remote D1 write, Access enablement/policy write, secret write, upload/deploy, admin provisioning, DNS/email record change, real email, checkout, registration or merge occurred.

## Confirmed settings and bindings

Owner-supplied administrator: **admin@afnancollectionkn.com**. Testers: **owner only**. Proposed Resend sender: **orders@afnancollectionkn.com**. These are selected settings, not verified identities or an authenticated sender. No alternate mailbox has been invented.

| Setting | Prepared value / evidence |
| --- | --- |
| Account | Owner-supplied account explicitly matched during read-only inspection; operational ID kept in ignored local config |
| DB | afnan-collection-acceptance; UUID 11950c2f-14bb-4a31-9add-356f155dea4e, GET confirms zero tables |
| MEDIA | afnan-product-media-acceptance; Standard storage, public managed endpoint disabled |
| ASSETS | Existing framework output .output/public, same Worker |
| Worker | afnan-collection-storefront; not uploaded or deployed |
| Proposed origin | https://afnan-collection-storefront.danwakili.workers.dev; existing account subdomain, no production DNS change |
| Exposure | workers_dev=false, preview_urls=false, routes=[]; no endpoint enabled |
| Runtime | APP_ENV=acceptance, CHECKOUT_ENABLED=false, PAYMENT_MODE=disabled, EMAIL_FROM=orders@afnancollectionkn.com |

The complete packaging config is `.wrangler/acceptance/wrangler.jsonc`, ignored and permission-restricted, using the actual verified account/DB and private bucket. The DB UUID above is an identifier, not a credential; no secrets are published. Dry-run packages this intended config and reports DB/MEDIA/ASSETS correctly. Do not deploy the top-level development placeholders or generated framework config. Local state using the same UUID is still a simulation, never remote migration evidence.

## Access and no-exposure plan

Refreshed GET now confirms the existing active team falling-poetry-120a.cloudflareaccess.com, one Cloudflare identity provider, zero Access applications and zero reusable policies. Earlier not_enabled responses are historical and superseded. No new organization enrollment is needed. MFA configuration/enrollment is not established by the returned organization fields and must still be reviewed and tested. Do not enable account-wide enforcement or alter existing project policies.

[access-plan.json](access-plan.json) proposes a reusable email-exact owner Allow policy and one root application covering all paths on the Afnan hostname, then an Afnan-only Worker destination after its ID exists. The application is default deny; no additional testers, email-domain/account-member wildcard, service token or webhook bypass. The email selector is applied only after identity verification; it is not itself authorization to provision staff.

Proposed MFA uses Access independent MFA with TOTP, biometrics or security key and a one-hour MFA/session interval. Independent MFA needs its configuration on the existing organization, with mfa_required_for_all_apps=false and enforcement scoped to the Afnan policy. The existing Cloudflare IdP alone is not evidence that an IdP-based auth_method=mfa requirement is supported; do not use that shortcut. Any alternative IdP requires separate review/approval. Email OTP alone is not proof of a second factor. No silent fallback to email-only access. See [Cloudflare MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/).

Keep all routes disabled while configuring protection. Before allowing any route, verify its exact hostname/application association and that all API/static/media routes are covered; prepare the Access configuration before enabling workers.dev. Never expose an unprotected endpoint temporarily. After Gate 3's authorized deployment, verify externally that missing/invalid Access cookies, other email identities and expired sessions are denied, including /api/admin, /api/auth, /api/me and /media. Test an old application cookie after Access expiry too. If preconfiguration/enforcement cannot be established for this hostname, stop without enabling it. No custom-domain or production DNS workaround is authorized.

Acceptance signup is now locked in the backend: emailOTP.disableSignUp=true and /sign-up/email disabled when APP_ENV=acceptance. Unknown identities get no email/code/account. This applies independently of a local fixture flag. Existing localhost fixture customer flows remain available to tests only. No customer identity should be pre-created under the owner-only scope.

## Sender verification and mailbox ownership

The code uses the Resend HTTPS API from Better Auth's OTP hook; no additional provider is needed. It requires AUTH_SECRET, RESEND_API_KEY and EMAIL_FROM. PAYSTACK_SECRET_KEY is omitted while payments are disabled. No values were retrieved or written. No Resend connector/verified provider account evidence is available here, so sending authorization and delivery cannot be certified.

Read-only Cloudflare zone-record listing returned **zero visible DNS records**, including no visible MX/SPF/DKIM/DMARC evidence. This observation does not prove public DNS or mailbox delivery status. Preserve the current website; have the owner reconcile DNS visibility/authoritative records before any change. No email has been sent or mailbox ownership tested.

Preparation for orders@afnancollectionkn.com:

1. Owner confirms the existing Resend account/team and authenticates ownership of afnancollectionkn.com in that provider. Retrieve its exact domain-verification record set in the approved account after authorization; do not fabricate a DKIM key, SPF include or provider region.
2. Review provider-issued DKIM selector/key and SPF/return-path (plus any required bounce MX) records. Place each on the exact provider-specified hostname; preserve inbound mailbox MX. Never add a second SPF record at an existing hostname; reconcile all legitimate senders and lookup limits. Do not change the selected From address without owner approval.
3. Review DMARC at _dmarc.afnancollectionkn.com and alignment to the selected From domain. Preserve any existing enforcement. If none exists, propose monitoring first and a verified report recipient chosen by the owner; do not invent a reports mailbox or enforce quarantine/reject before reviewing all legitimate senders. Require successful aligned SPF or DKIM and inspect Authentication-Results after an approved test.
4. Gate 3 separately authorizes exact DNS changes/provider verification and real test email. Record provider verified status, then actual delivery to the owner and SPF/DKIM/DMARC results; provider configuration alone is not delivery proof.

Provider sources: [Resend domain verification](https://resend.com/docs/add-a-domain), [verified sending domains](https://resend.com/docs/dashboard/domains/introduction), [DMARC rollout](https://resend.com/docs/dashboard/domains/dmarc). No supplied DNS records are ready to apply because the provider-generated values are still missing.

## Verified owner provisioning, audit and revocation

Mailbox selection grants no rights. In the approved execution phase, owner demonstrates mailbox control via a real one-time verification challenge over the protected origin, never by sharing credentials/codes in chat. An account-authorized operator independently confirms the business owner's identity using the established business handoff and records an approval reference, without storing identity documents or unnecessary PII in Git.

Since public registration is disabled, use a separately reviewed, parameterized, account-owned procedure to create exactly the selected owner identity initially unverified/no staff role. After successful email verification and independent business verification, target that precise user ID and verified email; insert staff role admin only if no conflicting role exists. In the same reviewed database batch record audit actor, action, user ID and approval reference, then re-read role/verification state. Do not overwrite an existing role silently; do not grant admin to a first signup. No remote SQL procedure was executed, and the local bootstrap script remains local-only.

Recovery must verify the same ownership again before mailbox/role replacement. Revocation removes the staff role and application sessions and records an audit event, then revokes Access sessions/removes the exact owner Allow policy as appropriate. Possession of an old app session must not restore staff permissions. A second administrator/recovery identity is not authorized by this owner-only scope; the account operator's controlled recovery is the documented fallback. Audit/log evidence stays protected and must never contain OTPs, secrets or customer bodies.

## Migration identity guard, backups and recovery

[Migration review](migration-review.json) records ordered immutable checksums for 0001_commerce.sql and 0002_admin_management.sql. Before any remote execution, assert the account and exact UUID/name above, zero existing tables/expected ledger, intended migration checksums and acceptance config. Abort on a mismatch; never select a database by a similar name or another project's binding. No tests/fixtures.sql or copied local data remotely.

The SQL is forward-only, not raw-SQL idempotent. Wrangler's ledger provides repeatability. Local apply/reapply confirms both ordered entries and no pending changes; PRAGMA foreign_key_check returns no violations. Reviewed constraints/triggers preserve effective prices, stock reservation atomicity, cancellation/expiry restoration and history across soft deletion. Existing runtime tests exercise these paths.

Before Gate 3 migrations, record a baseline export/recovery point even for the empty target if supported, verify plan-specific Time Travel retention and recovery authorization, and keep records outside Git. Each failed migration is rolled back by the runner; earlier successful migrations remain. Reinspect the ledger; use a forward fix rather than destructive down SQL. Export/restore commands themselves require their execution approval. Restore-test in an independently approved isolated target before claiming recovery readiness. Version rollback never restores D1/R2. On first deployment failure, keep the endpoint disabled; there is no prior Afnan version. Any deletion/recreation/data restore needs its own explicit scope. No production data/resource may be used as a test target.

## Gate 3 — remote actions needing explicit approval

The final numbered approval package is [GATE-3-APPROVAL.md](GATE-3-APPROVAL.md). It separates protected deployment, sender DNS changes and real email/administrator testing; the action details below remain unapproved.

1. Readiness verification plus backup/export/recovery-point capture, then apply the reviewed migrations to the exact acceptance D1; no other database writes.
2. Reuse the existing active team; configure approved independent MFA prerequisites and only Afnan's owner-only reusable policy/application. No new organization enrollment or global enforcement. Verify coverage before enabling an origin.
3. Set AUTH_SECRET/RESEND_API_KEY and approved sender settings securely on the intended Worker using a reviewed staged workflow; ordinary secret put/delete may deploy.
4. Upload/deploy the reviewed Worker and enable only its protected acceptance origin; leave apex/www, Lovable, preview aliases and other businesses unchanged.
5. Pre-provision the single owner identity; perform real mailbox verification and independent ownership checks; assign/audit the admin role only after both succeed.
6. Register/verify the provider sending domain and apply only separately reviewed exact SPF/DKIM/DMARC/return-path records if needed. DNS changes are not implied by an email-sending approval.
7. Send approved real verification/test emails and test owner product/images/inventory, denied unauthorized access, session expiry/revocation/recovery and logs/backup readiness.
8. Any future checkout, payments or public registration enablement, production change or PR merge remains a separate gate, excluded from protected acceptance approval.

Pending inputs before requesting execution: owner mailbox-control evidence, nominated verifier Aisha Idris Muhammad’s willingness/trusted-contact/per-action confirmation, Resend account/domain status and exact verification records, verification that the existing Cloudflare IdP authenticates the exact owner email plus an independent MFA method, approval of the proposed hostname, recovery operator and budget/retention review. Owner/tester/sender selections are already supplied; do not ask for them again or ask for secret values in chat.
