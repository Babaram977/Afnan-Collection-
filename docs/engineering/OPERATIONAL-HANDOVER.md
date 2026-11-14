# Afnan Collection operational handover

Current state: security implementation merged; application not deployed and no functional production URL verified. This is a handover of implemented controls and operator responsibilities, not a claim of operational acceptance. Source: main 2942789a542fc3bf032699f06e6077b603810fc3; exact-main CI passed in run 43607435872.

## Administrator access

Use only admin@afnancollectionkn.com after independent owner verification, separately approved pending provisioning and personal email/WebAuthn enrollment. Follow ADMIN-RECOVERY-RUNBOOK.md. No account-member invitation/shared IdP change is needed for the application flow. Aisha Idris Muhammad is nominated only, not verified or granted access. The Cloudflare recovery operator is a distinct role and must secure their own control-plane account. Restricted evidence storage and retention still need selection.

There is no live enrollment link. The intended future owner page is https://afnancollectionkn.com/admin, contingent on explicit hostname/DNS approval and verified deployment; do not use that address as evidence that enrollment is ready. Passkeys are origin/RP-bound. Temporary-origin enrollment must not be represented as production enrollment. Once hosted: owner signs in personally with an email code, enrolls a verified authenticator, saves recovery codes offline, adds a separate backup device after fresh MFA, and completes challenge/denial/session/recovery acceptance. Never send OTPs, recovery codes, session cookies or device keys to support or commit them.

## Product and inventory operations

Follow ADMIN-GUIDE.md for genuine product/category/variant setup, uploaded photos, main-image ordering, prices in naira, draft review, opening stock and publishing. Prices are stored as integer kobo. Do not invent products, prices, stock, delivery rates or safety claims. Review mobile display and alternative image descriptions before publication. Uploads accept signature-checked PNG/JPEG/WebP up to 5 MB server-side; draft/unreferenced objects are not publicly served. Product removal does not imply destructive media deletion. Inventory adjustments must include an operational reason; never assume a refund restocks returned goods.

The remote D1 remains empty. A real approved catalog, inventory and operating delivery areas/terms are therefore also required before a commercially useful launch. Owner product entry requires the protected authenticated environment first; no fixture merchandise is uploaded remotely.

## Orders and payments

Only authenticated staff with current MFA may use order management. Fulfilment staff cannot edit catalog/customer directory/payment settings. Inspect the actual order and payment state before acting; use permitted processing/shipped/delivered transitions and preserve audit evidence. Do not mark a browser callback as payment proof. Pending reservations expire/cancel through server controls; paid orders do not use unpaid cancellation. Refunds require reconciliation and separate stock inspection.

Public checkout/payments/registration remain disabled. Local tests simulate commerce only. Do not accept real payment, turn on Paystack keys or create customer orders to demonstrate launch readiness. Public enablement and real payment processing need their respective approvals; this handover does not authorize them. Hosted acceptance must first verify the disabled flows deny safely. Later separately approved sandbox checks must use labelled test transactions, never real customer payments.

## Customer support

Use the approved business contact configuration, including WhatsApp +2347035963225. No messages are sent by this task. Explain unavailable checkout/registration accurately until approved activation. Collect only the minimum order reference and business-approved contact information through an approved support channel; do not request authentication codes, recovery codes, card details or passwords. Verify order ownership through the approved support procedure before disclosing records. An email matching an order is not sufficient to transfer a guest order to an account. Loss of the guest browser cookie requires a reviewed support process, not an automatic override. Delivery/returns/refund promises must match approved policy content; unresolved policy/retention decisions remain owner work.

## Configuration inventory (no secret values)

| Setting | Intended dedicated value/status |
| --- | --- |
| Cloudflare account | b4e142fe9da84ef204eecda2efe4a730 |
| Existing Worker | afnan-collection-storefront; debc58162c864e1e8ded0d63bb8823b5; undeployed |
| DB | afnan-collection-acceptance; 11950c2f-14bb-4a31-9add-356f155dea4e |
| MEDIA | afnan-product-media-acceptance; private; no R2 custom domains |
| ASSETS / entry | .output/public / worker.ts |
| Runtime | nodejs_compat; compatibility date 2026-11-13 |
| Proposed public APP_ORIGIN | https://afnancollectionkn.com; DNS/hostname authorization pending |
| EMAIL_FROM | orders@afnancollectionkn.com |
| EMAIL_SENDER_VERIFIED | false in review template; owner reports domain verified, live sending not certified |
| Required secrets | AUTH_SECRET, RESEND_API_KEY; unavailable/not installed |
| Checkout / payment mode | false / disabled; no Paystack key needed |
| Public registration | disabled outside explicit localhost fixtures |
| Worker URLs / routes | workers.dev false, previews false, routes empty |

config/wrangler.production.example.jsonc is a reviewed template, not an upload instruction or permission. Reuse only these resources. Do not attach Heroine Collection, DrippleX or Landonova data/services, create another Worker or overwrite Lovable routing.

## Monitoring and incident response

Before activation, verify Worker logs/traces, request IDs, alert delivery and an authorized incident operator. Inspect error rates, latency/CPU, D1 failures/quotas, R2 upload/retrieval errors, email delivery/quota/bounces, denied logins/MFA failures, recovery events and unusual staff mutations. Configure retention and access before collecting live personal data. Record only event IDs/status and necessary opaque entity references; redact request bodies, recipient/provider responses, credentials and cookies. auth.email.unavailable is a fixed diagnostic event; a generic email request acknowledgement is not delivery evidence.

For suspected account takeover: preserve sanitized audit evidence, obtain incident authorization, disable only the affected Afnan identity/increment its epoch and revoke sessions using the reviewed recovery runbook. Do not delete security controls, switch identities, disable MFA globally or grant emergency staff by email. Contact the verified owner/recovery operator through established trusted channels. Unknown operator contact/escalation/retention details must be confirmed, not invented. If the origin must be closed, obtain the scoped incident action and preserve other businesses/DNS routing. Test alert/recovery procedures before declaring them operational.

## Deployment and recovery

PRODUCTION-AUTH-READINESS.md contains the reviewed identity-guarded migration, secret staging, protected test-origin, hostname, release and rollback procedures. Use exact-release passing CI. Do not apply remote migrations until recovery readiness and explicit migration approval. Confirm plan-specific Time Travel retention; store an approved export off Git in protected durable storage and rehearse an authorized restore. Local export/restore passed; remote export creation/download was rejected by automatic approval review pending explicit data-transfer approval. The read-only remote bookmark is captured only in ignored local preflight staging; that staging is not an approved durable audit/backup store.

First release has no prior Worker version. If a test fails, keep the origin disabled; do not remove MFA to recover. Subsequent version rollback does not roll back D1/R2 and must not reintroduce pre-MFA code. Prefer additive forward fixes. No destructive restore/schema/media deletion without specific approval and evidence. No deploy, migration, secret installation, real email or DNS operation has been performed by this handover.

The exact owner-only provider delivery message and separate hosted OTP acceptance scope are prepared in [Resend owner test](RESEND-OWNER-TEST.md). Neither has been executed or authorized.
