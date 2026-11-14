# Commerce architecture and review guide

Implemented under the owner's master execution instruction, 2026-11-13. This supersedes proposals in INITIAL-ASSESSMENT.md. It is a local/test implementation for technical review, not a production-readiness declaration.

## Architecture decision

One Cloudflare Worker serves TanStack Start SSR, static assets, auth and validated APIs. D1 stores catalog, accounts, sessions, addresses, carts, orders, variant stock, inventory movements, delivery zones, payments and audit records. R2 is justified by the requested multiple-image upload workflow; there is one optional media binding, and no bucket has been provisioned remotely. No queues, extra Workers or customer-service infrastructure were added.

D1 was selected over PostgreSQL because no existing Afnan PostgreSQL database/connection is present in the repo or configured session. D1's local batch transaction plus SQLite constraints/triggers covers the bounded reservation workflow and avoids a separately managed database, network driver and auth service. D1 billing is based on rows read/written and storage, with scale-to-zero compute; PostgreSQL could be preferable for larger analytical/integration workloads or long interactive transactions. We make no claim about an uninspected account's allowances or monthly bill. See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch). Current docs were retrieved for review; the documentation-search connector returned an internal error, so direct documentation and installed runtime evidence were used.

The original TanStack versions remain; Vite is patched to 8.1.6, the Lovable wrapper to 2.27.0, Vitest to 4.1.12 and runtime validation to Zod 4.6.7. Targeted transitive overrides address advisories; minimatch 10→11 and brace-expansion 4→5 are deliberate security upgrades covered by lint/build/tests. The overrides require Bun lockfile format 3, hence the pinned Bun 1.4.4. Nitro and Miniflare include prerelease versions; retain runtime regression coverage and re-evaluate before launch.

## Data and trust boundaries

`migrations/0001_commerce.sql` is the initial forward migration for a new Afnan database. It seeds only the approved category labels; **no real products, stock, active delivery zones, fees, policies or customers are invented**. Do not apply it to an unrelated or existing populated database without review. `0002_admin_management.sql` adds promotional pricing, soft deletion and business settings and replaces the reservation trigger to use the effective price. Both migrations have been exercised locally. The CLI migration has been tested with `--local` only. It does not destructively reset production data.

Checkout sends variant IDs/quantities, contact, address and zone ID. Price snapshots come from the database; delivery must match an active zone for the supplied state. One D1 batch inserts the order and its items, reserves stock through a trigger and computes the final total. If any item fails, the whole batch rolls back. Integer kobo and nonnegative stock constraints apply at the database boundary. Unique `(owner,idempotency_key)` plus request fingerprint detects retries and changed payloads. The browser retains only a payload hash and attempt key in sessionStorage for reload-safe retries.

Reservations currently last 30 minutes. This is an explicit development default, not an approved customer delivery promise. Expired pending reservations are released lazily on catalog reads, checkout/order operations and the admin overview, requiring no new scheduler. Cancel/expiry transitions restore stock once. Paid→processing→shipped→delivered is a guarded workflow. Refunds do not automatically return goods to saleable stock: staff must inspect and make an audited adjustment. Production retention, returns, reservation policy and fulfilment procedures still require owner approval.

Public catalog endpoints expose active products only. Admin data/writes require a verified Better Auth session, D1 staff role, active enrollment and current WebAuthn-verified privileged session on every request. Admins manage catalog, variants, stock, categories, banners, delivery fees, approved page copy, customers/session revocation, payments and audit views. Fulfilment staff see the overview and orders and can advance fulfilment; they cannot manage catalog, stock, customer directory or payment actions. Public routes never accept an arbitrary owner ID. Guest orders are scoped to a random HttpOnly, SameSite cookie; loss of that browser session means guest history is unavailable. Signing in does not silently claim an unrelated guest order merely because its email matches.

Cart storage contains only selected variant IDs/quantities on the server. Browser display fields/prices are rehydrated from active catalog data and quantities are bounded. There is a device-local fallback if cart sync is unavailable; final checkout always revalidates authoritative data. Dynamic category labels and published banners/content come from D1 while retaining the approved layouts.

## Authentication and media

Better Auth + Drizzle/D1 supplies single-use email-code registration/sign-in and recovery. There is no custom password cryptography. Codes expire after five minutes, attempts are bounded, stored verification values are hashed and sessions expire after seven days. Production email delivery requires a verified Resend sender/domain and protected runtime credentials; no real email delivery has been tested. The fixture mail sink is localhost-only and lives in `tests/fixtures.sql`, outside production migrations.

First-admin bootstrap is deliberately unavailable over HTTP. Follow ADMIN-RECOVERY-RUNBOOK.md for controlled pending enrollment, exact owner identity and audit references; mandatory WebAuthn must complete before privileged access. The local bootstrap cannot invoke remote D1. Roles and primary sessions alone never authorize administration.

JSON bodies are bounded, Zod-validated and parameterized in SQL. Writes require the configured same origin; auth also validates trusted origins. D1-backed per-IP windows protect auth and APIs across isolates, alongside Better Auth's own limiter. Trust only Cloudflare's supplied connecting IP header behind the real edge. Health responses omit secrets. Logs contain event, request ID and path rather than customer bodies, codes, keys or payment payloads. The old module-global error-capture buffer was removed to avoid cross-request error association.

R2 uploads require admin role, bounded size (5 MB), allowed PNG/JPEG/WebP signatures and random keys. SVG/HTML uploads are rejected. Public media is served only when referenced by an active product or banner, with a fixed image content type and `nosniff`. No remote image URL proxy or arbitrary browser-provided image path is accepted. Image transcoding/scanning and storage lifecycle should be evaluated against actual merchandise photos before launch.

## Paystack only — no live payments

The owner confirmed Paystack is available. Flutterwave is not implemented. Paystack was selected on that evidence and the Nigerian/NGN requirement; merchant KYC status, entitlements and actual API credentials are not independently verified.

`PAYMENT_MODE=disabled` is the checked-in default. `test` accepts only a `sk_test_` key; `sk_live_` keys are deliberately rejected. There is no live mode. The adapter initializes a fixed order reference and server amount in NGN, permits only Paystack's checkout origin and uses a fixed owner-domain callback. A return page is never proof of payment.

Webhooks require SHA-512 HMAC verification of the original body, then server-side transaction verification of reference, amount, currency and status. Provider event IDs and transaction IDs are deduplicated. Late payments become `review` and do not reacquire stock. Admins can reconcile transactions and initiate/check a full test refund. Refund initiation is durably claimed before the external request; ambiguous network failures stay pending and require provider-side reconciliation, not a blind repeated refund. Refund status is verified against provider transaction ID, currency and amount. Partial refunds are not implemented.

Controlled fixtures keep provider transaction state separate from the app payment table, so amount mismatch tests are meaningful. These fixtures verify application behavior, **not Paystack merchant eligibility, real sandbox connectivity, settlement, webhook delivery or refunds**. Test keys must be entered through protected environment settings or ignored local `.dev.vars`, never chat/Git. Sources consulted: [webhooks](https://paystack.com/docs/payments/webhooks/), [refund API](https://paystack.com/docs/api/refund/) and the documented initialize/verify transaction API.

## Review limits and activation gates

- `CHECKOUT_ENABLED=false`, `PAYMENT_MODE=disabled`, workers.dev/previews disabled, no account ID or domain routes. D1's zero UUID and development bucket name are local placeholders. Do not deploy this config as a production manifest.
- No public deployment, real order processing, live charge, production DNS change, remote provisioning or merge was performed or authorized.
- Supply real catalog and opening stock; approve delivery fees/zones and business policies. A public contact does not establish operating hours or delivery promises.
- Configure isolated resources, verified email delivery, strong auth secret and test Paystack credentials; run external-service acceptance tests before release approval.
- Resolve private repository preference, account ownership/limits, backups/restore/retention, staff bootstrap and operational monitoring. Customer-data retention and audit access need business/legal review.
- Record/query lists are bounded (public catalog 500 products/5000 variants; admin lists 200–500 rows). Introduce pagination and reports for larger datasets before those limits become material.
- No test proves the entire absence of security defects. Arrange focused production security and business acceptance review before owner-authorized activation.

## Independent owner workflows

The latest owner instruction adds guided management rather than requiring technical identifiers. Products now support generated/assigned SKUs, regular/promotional prices entered in naira, opening stock, private multi-photo previews, main-image ordering, photo unlink/replacement, and soft deletion preserving orders. Existing variants are adjusted through the stock movement workflow. Admin publication requires a priced option and appears in the storefront directly from D1. Contact settings are validated overrides of the shared official business module, resolved for public UI/SEO. The same generic optimized photo field supports optional homepage banner photos. See ADMIN-GUIDE.md.

Afnan has no connection to Heroine's database, customers, auth roles, secrets or media. Local resources are isolated; dedicated remote resources still require ownership review and activation authorization.
