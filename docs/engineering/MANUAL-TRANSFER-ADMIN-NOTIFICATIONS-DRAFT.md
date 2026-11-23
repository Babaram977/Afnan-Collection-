# Afnan Collection — manual-transfer checkout and administrative alerts

**Draft integration plan, not permission to deploy.** Afnan Collection Online (`afnancollectionkn.com`) is separate from Heroine Collection and Afnan Homes. Preserve its children’s-store brand, current repository architecture, inventory, sign-in mode and D1/R2 resources. Never copy Heroine production data, customer records, secrets, branding, WhatsApp or banking details.

## Existing functionality to preserve (inspected 22 November 2026)
- Afnan already implements server-calculated NGN checkout with delivery zones, idempotency, stock reservation, payment-review controls and expiry/cancellation.
- `migrations/0004_bank_transfer_reservation.sql` and `0005_payment_receipts.sql` implement manual-transfer and receipt records.
- `src/backend/receipts.ts` screens JPEG, PNG, WebP and PDF uploads to 5 MB, uses a **separate private RECEIPTS R2 bucket**, protects owner-only retrieval, and treats screenshots as untrusted evidence.
- `src/backend/email.ts` has `sendPaymentReviewNotice` for staff notification; the production sender and the sales mailbox have not been independently verified.
- Owner-supplied business settings in `src/lib/business.ts`: Moniepoint Microfinance Bank, beneficiary **Afnan Collection**, account **7035963225**; WhatsApp **+2347035963225**; staff mailbox `sales@afnancollectionkn.com`. **Reconfirm actual credited beneficiary and mailbox ownership before release.** No account changes are authorized by this draft.
- The repository currently says checkout/payments are disabled by default and **not launched**. The Paystack adapter is test-only; do not introduce live gateway mode.

## Required user experience (same principle as Heroine, independent implementation)
1. Customer confirms actual variant, delivery zone/fee, contact, stock and NGN total; places a unique order with a bounded reservation deadline.
2. Display verified Moniepoint beneficiary/account and the exact order reference. Status **Awaiting Transfer**, never Paid.
3. Customer can upload a receipt (JPG/PNG/WebP/PDF, <=5 MB) using the existing safe receipt API/private bucket, and optionally provide transfer reference. Receipt upload must never mark payment successful.
4. Provide an order-prefilled WhatsApp link to the **Afnan** configured number. Include reference and amount and invite the customer to attach their own receipt; do not claim WhatsApp can attach website files automatically. Do not include bearer tokens or private receipt URL in the link.
5. Payment verification remains owner/admin-only (not fulfilment staff): require verified bank statement reference, exact credited total/currency and existing MFA/role guard appropriate to the configured Afnan admin authentication. Late transfers enter manual reconciliation, never silently reacquire sold-out stock.
6. Display immutable audit history, distinct payment and fulfilment states, and suitable customer confirmations without suggesting an automated refund.

## Notification implementation scope
- Add a durable D1 administrator notification inbox in Store Management. Events: `order.created`, `bank.reference_submitted`, `receipt.uploaded`, `payment.verified`, `receipt.rejected`, `reservation.expired` where the actual state transitions exist. Use event IDs/idempotency and read/unread timestamps.
- Show an unread count on Orders/dashboard and a filterable event list; poll while the portal is open (e.g. 20 seconds). Optional browser Notification API requires explicit owner permission and an active portal; **not background Web Push**.
- Add separately consented background Web Push only if needed: a registered service worker, VAPID subscription bound to the current admin account, secure storage/revocation on logout, minimized push payloads, provider/endpoint expiry handling, and iOS home-screen/PWA device validation. Do not claim supported until proven.
- Use the existing `sendPaymentReviewNotice` and Resend sender to send staff notices to the verified **Afnan** mailbox. Move notifications to durable retryable outbox, stable idempotency keys, per-event quotas/backoff and redacted logs. A provider-accepted email is not a guaranteed delivered message. The receipt file and full customer details never go in email.
- One event can fan out to inbox, optional browser notification and email; failure of any channel must not roll back orders or mark payments paid.

## Must-pass tests
- Wrong/duplicate IDs, malicious spoofed MIME/PDF files, file-size bounds, forged session, CSRF, rate limits, private receipt read, outbox duplicate/retry and event delivery failure.
- Concurrent reservation, cancel/expiry restoration, amount mismatch, replayed bank reference, late payment, admin/fulfilment role separation, and reconciliation under repeated verification.
- Browser and actual iPhone Safari checkout, WhatsApp handoff, receipt upload, admin review, payment status, notification badge and email delivery.
- Security scan, typecheck, lint, integration/migration replay on isolated populated Afnan data, exact-head CI and deployment rollback.
- Verify bank beneficiary, sales mailbox, contact number, delivery zones/rates, return/privacy policies and sending domain **before production activation**.

## Release boundary
Do not enable checkout, Paystack live mode, customer emails, Web Push, or change Cloudflare/DNS, Bank/Moniepoint settlement, migrations or access policies as a side effect of this draft. Implement on a separate feature PR with targeted regression coverage. Merge and deploy only after complete exact-commit validation and a separately verified production configuration; no fixture stock or test receipt should be copied into production.
