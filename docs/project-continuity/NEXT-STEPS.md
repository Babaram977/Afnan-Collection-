# Resume development

## Mandatory continuity workflow

1. Read AGENTS.md and all five continuity records. Fetch latest main, feature branch, PR diffs/reviews and exact-head CI; current GitHub evidence takes precedence over this snapshot.
2. Use `feat/commerce-platform` / [draft PR #2](https://github.com/Babaram977/Afnan-Collection-/pull/2) as the active implementation. It starts from main aedef6a and contains backend 34b526c, storefront a719f5e and owner management/official contacts def2302, followed by continuity docs. Do not rebuild completed work or assume it is merged.
3. Preserve prior decisions and record meaningful changes with reasons, alongside implementation. Never include secrets/customer data. Keep Afnan records separate from Heroine/DrippleX.

## Owner review and outstanding inputs

- Review the working local fixture flow and docs/engineering/ADMIN-GUIDE.md. Select the owner email and verify business ownership before privileged staff assignment. There is no public bootstrap endpoint.
- Preserve the installed original PNG and run branding checks for future asset/layout changes.
- Resolve repository private-visibility preference. Supply genuine products/photos, option SKUs/prices and opening stock through the dashboard; do not seed fictional merchandise outside tests.
- Approve operational Kano delivery zones/fees, returns/privacy/retention, reservation expiry and refund/restock procedures. The official contact/registration information is already recorded; CAC/TIN are supplied, not independently verified.

## External acceptance and production preparation

- Confirm the dedicated Cloudflare account/plan and isolated D1/R2 bindings; do not connect Heroine resources. Review backups/restore, observability and limits before any resource activation.
- Enter strong AUTH_SECRET and verified transactional email configuration through protected settings, never chat/Git/VITE_*. Verify sender-domain ownership and real email-code delivery/session behavior.
- Enter Paystack TEST credentials securely and validate actual initialization, callback, signed webhook delivery, server verification, duplicate/late events and full-refund reconciliation. Live mode/keys remain disabled. Unknown outcomes must not trigger blind duplicate refunds.
- Reproduce clean frozen install, typecheck, lint, unit tests, Worker build/dry-run, local integration and Chromium/axe checks on the reviewed head. Verify actual GitHub CI separately. Inspect external-service behavior in an authorized isolated environment.
- Only after explicit authorization: merge reviewed work, provision/configure approved remote resources, run reviewed production migration/bootstrap, deploy and attach the domain. No production DNS, deployment, real orders or live charges are authorized by the current work.

Do not claim the backend is live or production-ready from fixture success. Keep README, UI standard and continuity records aligned with verified behavior.

## Final-integration next actions

- Stay on PR #2 / feat/commerce-platform; retain cart follow-up b5bf71a and consult the latest exact-head CI. Do not restart the backend or create another PR.
- Read docs/engineering/RELEASE-CHECKLIST.md for the concrete resource/configuration/acceptance/rollback/cutover checklist. Cloudflare is connected, so do not ask for generic reconnection: resolve the missing domain visibility and R2 enablement with the account owner. Provision nothing without the stated approval.
- Original PNG integration is complete; preserve the canonical path and verified checksum in AFNAN-BRAND-ASSET.json.
- Collect the owner-admin email/ownership confirmation, verified email sender and protected credentials, Paystack TEST credentials/eligibility, genuine photographs/catalog/opening stock, Kano fees/zones/policies and retention/backup/monitoring decisions. Never ask for secret values in chat.
- Get explicit approval for an isolated protected acceptance origin/resource setup/test deployment/test checkout before external-service acceptance. Keep production checkout/payments disabled. Merge, production migrations, public deployment, DNS cutover and live mode remain separately gated.

## 2026-11-13 — original PNG integration (supersedes missing-file reports)

The original PNG uploaded in commit `3ef6de5` as `public/brand/IMG_8842(2).png` is now installed at `public/brand/IMG_8842(1).png` through a byte-preserving rename. SHA-256 verified: `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`. The 145,165-byte, 460 × 546 image is used unchanged in the shared header/footer, PNG website icon, Store structured data and homepage social metadata. No crop, recolouring, redrawing or derivative was made; the traced SVG remains reference-only and unused.

Local validation: typecheck, lint and Worker build passed; 111 responsive/browser checks and 88 dedicated branding assertions passed at 320/390/768/1440 px (branding). The branding suite is included in CI. Continue on draft PR #2 / feat/commerce-platform; reconcile exact-head CI from GitHub. No merge, deployment, provisioning or checkout/payment activation occurred. R2 enablement, domain visibility and external acceptance remain separate launch gates.
