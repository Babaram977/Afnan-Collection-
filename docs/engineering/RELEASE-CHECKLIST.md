# Controlled activation checklist — Afnan Collection

Current Gate 2 review: [acceptance/GATE-2-REVIEW.md](acceptance/GATE-2-REVIEW.md). Owner-only identities, MFA and sender verification requirements there supersede earlier general tester/self-registration procedures. This phase performs no remote writes; all Gate 3 actions remain unapproved.

Evidence: 2026-11-13. Continue PR #2 / feat/commerce-platform from baseline 1667408; do not rebuild the backend or change providers. This checklist prepares reviewable activation steps; it grants no permission to execute them.

## 2026-11-13 — owner-approved acceptance storage creation

Owner explicitly approved creation of the named acceptance D1 and R2 only, following the clarification that Worker upload/deployment remains separate. Created afnan-collection-acceptance (DB) and afnan-product-media-acceptance (MEDIA, Standard) in the verified account. GET confirms D1 has zero tables; no migrations or customer data were added. R2 public r2.dev access is disabled and no custom domains exist. Creation succeeded without subscription or billing-setting changes, proving D1/R2 creation permission for these resources. Default placements returned WEUR for D1 and EEUR for R2; no jurisdiction restriction was requested.

Worker afnan-collection-storefront remains planned, not created or reserved. The same six existing Workers retain their pre-action modification timestamps. No deployment, secrets, role assignments, email setup, DNS, production infrastructure or checkout/payment changes occurred. Resource IDs are retained in ignored protected local operator records, not public documentation. Next gates are separately authorized migrations, protected origin/testers, secure email/auth configuration, owner role assignment and controlled Worker upload/deployment; sandbox checkout remains separate.

Application source remains unchanged from the validated 8439b70 baseline (both CI runs 43445561177 and 43445552543 passed). This milestone changes documentation only; verification used actual create responses plus GET resource/public-access/Worker inventory readback. Historical “not provisioned” statements below describe earlier stages and are superseded for these two acceptance resources only.

## Read-only Cloudflare inventory

The owner-supplied account/zone IDs now resolve to the intended account. This supersedes the earlier inventory against a different account. Read-only verification on 2026-11-13 found:

| Item | Verified result | Remaining gate |
| --- | --- | --- |
| Workers | Six existing scripts, no Afnan Worker | Approved Afnan-only upload/deployment |
| D1 | GET succeeds, zero databases | Approved dedicated acceptance database creation |
| R2 | GET succeeds, two DrippleX buckets; no Afnan bucket | Subscription/budget review and approved create; do not reuse existing buckets |
| afnancollectionkn.com | Active, full zone in intended account | No domain visibility blocker; production routing remains unchanged |
| Permissions | Reported worker, D1 and R2 edit permissions | Creation remains untested; Billing Read is unavailable through OAuth |

Account subscriptions GET returned 403/code 10000; connector reports no OAuth scope for this billing endpoint. Owner Dashboard review or a protected Billing Read token can establish subscription details. No generic reconnection or automatic billing enablement is needed. Account email/IDs remain in the protected owner handoff. Nothing was provisioned or deployed.

See [ACCEPTANCE-RUNBOOK.md](ACCEPTANCE-RUNBOOK.md) for exact commands, protected-origin sequence, current pricing, privilege checks and rollback. It supersedes old account/domain/R2 blockers while preserving all approval boundaries below.

## Dedicated resource names and bindings

Proposed names are exact, but resources are **not provisioned**. Keep Afnan separate from Heroine/DrippleX. Use one Worker; no queues or extra services are required.

| Resource                             | Proposed name                    | Binding / purpose                                                     | Gate                                                                                         |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Worker                               | `afnan-collection-storefront`    | SSR, assets, Better Auth, commerce APIs and media delivery            | Owner-approved account and controlled deployment scope                                       |
| Production D1                        | `afnan-collection-production`    | `DB`; record the real database UUID after authorized creation         | Explicit resource/cost approval; empty dedicated database                                    |
| Production R2                        | `afnan-product-media-production` | `MEDIA`; private merchandise-image storage                            | R2 enabled and explicit resource/cost approval                                               |
| Acceptance D1, before production use | `afnan-collection-acceptance`    | Temporary replacement for `DB` during isolated external acceptance    | Separate approved test data/resource scope; never bind production customer/inventory records |
| Acceptance R2, before production use | `afnan-product-media-acceptance` | Temporary replacement for `MEDIA` during isolated external acceptance | Dedicated test photos/objects; never reuse another business's bucket                         |
| Static assets                        | Build-generated `.output/public` | `ASSETS` on the same Worker                                           | Approved immutable build/commit                                                              |

The existing `afnan-development` and `afnan-product-media-development` config with a zero database UUID is local preparation only. Do not deploy those placeholders or assume an environment inherits the right bindings. Acceptance and production may be bound to the same named Worker at different reviewed stages; no second Worker is proposed. Protect the controlled test origin before accepting remote test traffic, and review how authorized Paystack sandbox callbacks can reach the signed webhook. Neither test origin nor protection/routing has been created.

## Runtime configuration

| Name                    | Initial controlled-activation value / action                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`               | `acceptance` for isolated external testing, later `production`; never use localhost fixture mode remotely                               |
| `APP_ORIGIN`            | Exact owner-approved HTTPS acceptance origin; production is `https://afnancollectionkn.com` only after separately authorized cutover    |
| `AUTH_SECRET`           | Generate at least 32 random bytes; enter through protected Worker secret settings; never Git/chat/VITE_*                                |
| `RESEND_API_KEY`        | Verified transactional email account secret for the existing adapter; do not switch email providers in this handoff                     |
| `EMAIL_FROM`            | Actual verified sender supplied by owner; no business email address has been invented                                                   |
| `PAYSTACK_SECRET_KEY`   | Paystack TEST key entered securely, only after merchant/test-account confirmation                                                       |
| `CHECKOUT_ENABLED`      | Keep `false`; enabling test checkout requires explicit scope approval for the protected, isolated test backend                          |
| `PAYMENT_MODE`          | Keep `disabled`; `test` is allowed only after separately approved sandbox acceptance setup; live keys/mode are rejected by current code |
| `TEST_FIXTURES`         | Omit remotely; never set true on a remote deployment                                                                                    |
| `DB`, `MEDIA`, `ASSETS` | Verify actual dedicated bindings against the approved environment before upload                                                         |

workers.dev/public preview URLs remain disabled, and no production account/domain route is added by this PR. Secret writes and Worker version changes can themselves deploy; do not run them merely to “prepare” an environment. Stage/review configuration with the authorized operator first.

## Acceptance gates and evidence

1. **Original logo — satisfied:** original uploaded at 3ef6de5, byte-preserving rename to `public/brand/IMG_8842(1).png`, checksum verified against the owner record. Shared header/footer, native PNG icon, Store logo and homepage social metadata use the unchanged original. Automated branding checks cover served bytes and four viewport widths.
2. **Owner identity:** owner chooses the email, verifies the code delivered by the real sender, and an account-authorized operator independently confirms business ownership before assigning the admin role in the dedicated reviewed database. No public first-admin claim or production account is created by this task. Test customer and fulfilment accounts must remain unable to use admin APIs.
3. **Email:** verify sender ownership, real code delivery/expiry/replay limits, session cookies on the approved HTTPS origin, recovery and revocation. Any required email DNS changes need their own explicit authorization. Local OTP fixtures are not email-delivery proof.
4. **Database/media:** authorize isolated resource creation, apply the reviewed forward migrations only to the approved test database, verify the migration ledger, upload owner-supplied photos and inspect R2 delivery/private previews. Local D1/R2 tests simulate services; they do not prove account entitlements or remote bindings.
5. **Owner operation:** create/edit a genuine draft product; upload several photographs and choose the main image; set real option SKUs/prices/opening balances; publish; verify catalog visibility without deployment; record an adjustment; inspect purchased item/address details; advance an authorized test order through fulfilment; check customer history. Automated equivalents use clearly labelled local fixtures.
6. **Business setup:** owner approves real catalog/photos/prices/stock, factual age/safety information, operating Kano areas and delivery charges, returns/delivery/privacy policy, retention and reservation expiry. The approved contact links and registration numbers are already configured; registration/tax numbers are supplied, not independently verified.
7. **Paystack sandbox:** under explicit test-checkout approval, use an isolated backend/test identities only; verify initialization/authoritative amount, real signed callback delivery, server verification, retries, duplicate/mismatched/late events, cancellation, reconciliation and full-refund states. Browser return pages never prove payment. Current code has no live mode; real charging requires a separately authorized/reviewed enablement change.
8. **Logs/monitoring:** verify Workers Logs and traces actually receive redacted request-ID events, health checks reflect binding readiness, and the operator can investigate auth/order/payment failures without exposing codes, secrets or customer bodies. Choose alert ownership and spend/error thresholds; configuration alone is not observed monitoring.
9. **Backups/rollback:** review D1 recovery/Time Travel entitlement and retention, capture an approved pre-migration recovery point/export, inventory R2 object metadata and back up originals outside Git. Restore-test an isolated database/bucket. Record Worker version, commit, migration ledger and asset checksums. Worker rollback does not roll back D1/R2; only roll back code compatible with the current schema. Freeze checkout and reconcile payment events before any data recovery. No production restore/delete is authorized.
10. **Domain cutover:** first confirm Afnan zone/account visibility, capture existing Lovable routing/DNS/SSL settings and rollback values without modifying them, decide apex/www behavior, review auth origins/callbacks/secure cookies, and obtain explicit cutover approval. Do not disrupt the existing Lovable site during preparation. Execute domain changes only in the approved window, then verify HTTPS, routes/assets, auth, media and health from outside the environment. Public launch and real orders/payments require separate approval.

## Exact owner inputs still needed

- Original PNG delivery is satisfied; preserve the verified asset and checksum on future changes.
- Account and active-zone visibility are confirmed. Owner subscription/budget review and resource-creation approval remain required; no R2 enablement change is currently indicated.
- Chosen owner-admin email and verified ownership; approved staff roles/offboarding process.
- Actual verified email sender/account and protected Resend credentials; Paystack TEST credentials and merchant eligibility confirmation. Never send keys in chat.
- Initial genuine product photographs/descriptions/options/prices/opening stock; Kano delivery zones/charges and approved returns/delivery/privacy/retention/reservation rules.
- Approved protected acceptance origin and explicit permission for resource setup/test deployment/test checkout; production DNS/public deployment/live-mode approvals remain separate.
- Backup/restore/monitoring ownership and retention targets; repository private-visibility decision remains outstanding.

Do not describe the backend as live or declare controlled remote acceptance complete until the relevant external-service evidence exists. PR #2 stays open for review.
