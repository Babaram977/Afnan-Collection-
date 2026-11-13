# Controlled activation checklist — Afnan Collection

Evidence: 2026-11-13. Continue PR #2 / feat/commerce-platform from baseline 1667408; do not rebuild the backend or change providers. This checklist prepares reviewable activation steps; it grants no permission to execute them.

## Read-only Cloudflare inventory

The existing Cloudflare connection authenticated successfully. One account was visible. Read-only inventory returned:

| Item                  | Observed result                                                                       | Consequence                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Afnan Worker          | No matching Afnan script visible                                                      | Dedicated Worker still needs an authorized creation/deployment                                                                    |
| D1                    | No databases visible in this account                                                  | No existing Afnan database ID can be bound                                                                                        |
| R2                    | HTTP 403, Cloudflare code 10042: “Please enable R2 through the Cloudflare Dashboard.” | Owner must review/enable R2 and any billing requirements; no bucket was created                                                   |
| afnancollectionkn.com | Exact zone lookup returned no visible match                                           | Confirm the correct account and token/zone visibility before any domain work; this does not establish that the domain is inactive |

This is not an expired-connection finding. No reconnection loop, resource creation, DNS write, secret mutation or deployment was performed. Account email and operational identifiers are deliberately not copied into the public repository. Confirm the intended account through protected configuration before binding resources.

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

1. **Original logo:** obtain `IMG_8842(1).png`, verify SHA-256 `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`, retain the original in public/brand/, then integrate faithful header/footer/icon/social derivatives and test actual rendering. File is not currently accessible; a chat preview is not accepted as installation evidence.
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

- The original PNG file matching the supplied checksum, attached as a downloadable file or committed under public/brand/.
- Confirmation of the Cloudflare account owning afnancollectionkn.com and sufficient zone visibility; owner-reviewed R2 enablement/billing and resource budget approval.
- Chosen owner-admin email and verified ownership; approved staff roles/offboarding process.
- Actual verified email sender/account and protected Resend credentials; Paystack TEST credentials and merchant eligibility confirmation. Never send keys in chat.
- Initial genuine product photographs/descriptions/options/prices/opening stock; Kano delivery zones/charges and approved returns/delivery/privacy/retention/reservation rules.
- Approved protected acceptance origin and explicit permission for resource setup/test deployment/test checkout; production DNS/public deployment/live-mode approvals remain separate.
- Backup/restore/monitoring ownership and retention targets; repository private-visibility decision remains outstanding.

Do not describe the backend as live or declare controlled remote acceptance complete until the relevant external-service evidence exists. PR #2 stays open for review.
