# Implementation spec v1.0 — repository audit

Audit of the owner's "Storefront, Catalog, Inventory & Payment System — Implementation Specification v1.0" (15 Nov 2026) against `main` at `fff7295` (application = approved `2942789`; deployed acceptance version `0a2bfc57`). Read-only audit: **no code, migration or deployment was changed.** Evidence is file:line on `main`.

Legend: ✅ implemented · 🟡 partial · ❌ missing · ⚠️ conflicts with spec

## 1. Implemented (reuse as-is)

| Spec area | Evidence |
| --- | --- |
| Admin auth: Better Auth email OTP + mandatory WebAuthn admin sessions, recovery codes, `admin`/`fulfilment` roles, role-change session revocation | `migrations/0003_administrator_mfa.sql`, `src/backend/admin-security.ts`, `requireRole` `api.ts:108` |
| Product CRUD: draft/active/archived, featured, publish blocked without a priced variant, soft delete (`deleted_at`) keeps order history | `api.ts:615-675`, `0002_admin_management.sql:1` |
| Variant-level SKU (unique), size, colour, price (kobo, integer), sale price < regular price, per-variant stock and low-stock threshold | `0001_commerce.sql:13`, `api.ts:676-711` |
| Stock can never go negative (`CHECK stock>=0`); concurrent deductions fail atomically | `0001_commerce.sql:13`, `api.ts:712-724` |
| Oversell protection at checkout: trigger re-checks active product, stock and price per line inside one D1 batch | `0002_admin_management.sql:5-9` |
| Inventory movement log (reservation, opening stock, manual adjust with reason, cancel/expiry restore) + admin audit table | `0001_commerce.sql:20,27-30,33` |
| Idempotent order creation (owner + idempotency key + request hash), price snapshot in `order_items` | `api.ts:197-281` |
| Unpaid-order expiry releases stock automatically | `api.ts:131-137`, trigger `restore_stock` |
| Product photo upload to R2: admin-only, 5 MB cap, PNG/JPEG/WebP validated by **file signature**, random UUID keys, private by default; public `/media/*` serves only images attached to an **active** product or banner | `api.ts:847-863`, `worker.ts:11-29` |
| Multiple photos per product (≤12), per-photo alt text, "make main image", remove | `validation.ts:21`, `ProductManager.tsx:315-396` |
| Delivery zones per state with admin-set fee; checkout refuses when no active zone matches ("Delivery is unavailable") — never a silent zero fee; none seeded | `api.ts:218-222,743-753`, `0001_commerce.sql:42` |
| Customer WhatsApp/contact details centrally configured and admin-editable | `src/lib/business.ts`, `api.ts:602-614` |
| Checkout/payments kill-switches (`CHECKOUT_ENABLED`, `PAYMENT_MODE`) | `api.ts:198,393,513` |

## 2. Partially implemented

| Spec area | Gap |
| --- | --- |
| 🟡 Categories (§2) | Flat `categories(slug,label)` seeded with 11 different labels (`clothing, shoes, … gifts`, `0001_commerce.sql:41`). No department → subcategory hierarchy, no AC-01…AC-07 codes. Seed is already applied to acceptance D1. |
| 🟡 Age taxonomy (§3) | Products accept only 4 coarse bands `newborn/baby/toddler/kids` (`validation.ts:20`, `lib/catalog.ts:7`). Spec needs 11 bands, 0–3 m … 14–16 y, multi-select. No shoe-size system. |
| 🟡 Product fields (§4) | Missing: brand/supplier, material & care, weight & package dimensions, search metadata, `created_at` (only `updated_at`), product-level SKU/ID display. Existing `sale_price_kobo` is a *promotional* price; spec's "compare-at" should map to it rather than a new field. No preview of drafts in the storefront. No explicit out-of-stock *state* (derived from stock = 0 instead — recommended to keep derived). |
| 🟡 Media (§5) | Missing: drag/accessible move up/down (only "make main"), replace-in-place, variant/colour association, thumbnails/responsive sizes, EXIF/metadata stripping and orientation normalisation, orphan cleanup of uploaded-but-unused objects. |
| 🟡 Inventory (§6) | Single `stock` column is *available* stock; reservation decrements it. "Reserved" can be derived from pending orders, but there is no explicit reserved/committed view. Adjustments take a free-text reason; no correction type, no low-stock *alerts* (only an overview list), no search/filter by department/size/colour, no CSV export or validated import. Reservation length hard-coded at **30 minutes** (`0001_commerce.sql:16`, `expires_at … +1800`) — owner decision required, and too short for bank transfer. |
| 🟡 Delivery (§7) | Address = street, city, state only (`validation.ts:47`). No LGA, landmark, delivery instructions; zones are per state (no LGA list, no weight-based rates, couriers, tracking references or dispatch events). |
| 🟡 Order status (§12) | One combined `orders.status` (`pending, paid, processing, shipped, delivered, cancelled, expired, refund_pending, refunded`). Spec requires separate payment and fulfilment statuses. Shipment of unpaid orders is already blocked by the transition table (`api.ts:576-581`). |
| 🟡 Admin dashboard (§13) | Overview (product count, low stock, paid sales), orders list/detail/transitions, products, stock, zones, banners, policies, business settings, customers, audit exist. Missing: payments awaiting verification, receipts, bank-transfer settings, notification settings, staff management UI. |
| 🟡 Email (§10) | Only sign-in OTP via Resend, sender fixed to `orders@afnancollectionkn.com` and gated by `EMAIL_SENDER_VERIFIED` (`email.ts`). No order/payment notifications, no retry queue or delivery log. |

## 3. Missing

- ❌ **Manual bank-transfer checkout (§8)** — bank details display, copy button, payment instructions, reference display.
- ❌ **Receipt upload & private storage (§9)** — no receipt endpoint, no table, no private namespace, no review/reject/resubmit flow.
- ❌ **Payment review workflow (§12)** — staff approval/rejection with audit; *Awaiting Transfer → Receipt Submitted → Under Review → Paid/Rejected/Cancelled*.
- ❌ Sales notification email to `sales@afnancollectionkn.com` with authenticated admin link; notification delivery log and retries.
- ❌ Order-reference WhatsApp share link (static WhatsApp contact exists).
- ❌ Fulfilment events (packed, dispatched with courier + tracking ref).
- ❌ Inventory CSV import/export.

## 4. Conflicts with the spec ⚠️

1. **Payment model.** The application is built around Paystack (`payments.ts`, `/pay`, webhook, refunds, `payments.status` enum, checkout redirect to `checkout.paystack.com`, `checkout.tsx:85`). Spec v1.0 makes **manual bank transfer** the initial method and Paystack future/disabled. Recommendation: add bank transfer as a separate payment method alongside the dormant Paystack path (keep it disabled), not remove Paystack code.
2. **Category labels.** The 11 seeded categories differ from AC-01…AC-07. With zero products in acceptance, a forward migration can re-map safely, but the old slugs must be retired, not reused with different meanings.
3. **Age bands.** Existing 4 values must be migrated to the 11 approved bands; there is no product data yet, so no mapping loss.
4. **30-minute reservation** is a built-in policy the spec says the owner must decide.
5. **Sender vs recipient.** Code sends from `orders@afnancollectionkn.com`; spec names `sales@afnancollectionkn.com` as the *recipient*. Both mailboxes need confirming; neither is verified.

## 5. Proposed database changes (forward migrations only; nothing applied)

`0004_catalog_taxonomy.sql`
- `departments(code PK 'AC-01'…, slug UNIQUE, label, position)`; `categories` gains `department_code`, `position`, `active`. Insert the spec's 7 departments and 42 subcategories. Mark the 11 legacy categories inactive (kept for referential integrity; none referenced).
- `products`: add `brand`, `material_care`, `search_keywords`, `weight_grams`, `length_mm/width_mm/height_mm`, `created_at`. Replace `age_groups` values with the 11 band codes (validation change; JSON column unchanged).
- `variants`: add `size_system` (`clothing`, `eu_shoe`, `uk_shoe`, `us_shoe`, `one_size`), `image_key` (optional colour/variant photo).

`0005_bank_transfer.sql`
- `orders`: add `payment_method` (`bank_transfer`|`paystack`), `payment_status` (6 spec values), `fulfilment_status` (6 spec values), `reference` (human-readable unique order reference), `lga`, `landmark`, `instructions` (in `address` JSON — validation change only), `courier`, `tracking_ref`. Keep legacy `status` populated for compatibility during transition, or migrate and drop in a later step.
- `payment_submissions(id, order_id, receipt_key UNIQUE, content_type, bytes, sha256, submitted_at, status, reviewed_by, reviewed_at, decision_note)` with a unique `(order_id, sha256)` to stop duplicate submissions.
- `fulfilment_events(id, order_id, status, courier, tracking_ref, actor, created_at)`.
- `notifications(id, kind, order_id, recipient, status, attempts, last_error_code, next_attempt_at, created_at)` — no message bodies or secrets stored.
- Trigger: forbid `fulfilment_status` beyond `Not Ready` unless `payment_status='Paid'`.
- Replace hard-coded `+1800` expiry with a `settings` value once the owner sets the reservation period.

`0006_zone_lgas.sql` (after rates are supplied)
- `zone_lgas(zone_id, state, lga)` or per-LGA rate rows; static list of 36 states + FCT and their LGAs as reference data (sourced from an authoritative list, not invented).

**Storage:** receipts must not share the product-media bucket's public path. Recommended: a new private R2 bucket `afnan-payment-receipts-acceptance` (owner approval needed to create), served only through an authenticated admin endpoint with `no-store`; PNG/JPEG/WebP/PDF validated by signature, ≤5 MB.

## 6. Security implications

- Receipts contain personal/financial data: private bucket, non-guessable keys, admin/fulfilment-role retrieval only, never in emails or customer pages, audit on view/approve/reject.
- Customer receipt upload is an unauthenticated-capable endpoint (guest checkout): bind it to the order owner session + order reference, rate-limit, size-limit, signature-check, and refuse after `Paid`/`Cancelled`.
- Approval is a money decision: require `admin` (or a new `payments` role — owner decision), WebAuthn admin session, reason on rejection, and an immutable audit row; approval must be idempotent and refuse cancelled/expired orders (route to review, as the Paystack path already does).
- Bank-transfer expiry: an approved payment for an already-expired order must not silently re-reserve stock — route to manual review.
- PDF receipts must never be rendered inline from the storefront origin; serve as `Content-Disposition: attachment` with `nosniff`.
- Email: notification failures must not change payment state; store only status codes, never bodies.

## 7. Tests

None added in this audit. Each increment should extend the existing suites: `tests/runtime.mjs` (integration), `tests/acceptance.mjs`, `tests/admin-security.mjs`, `tests/storefront.mjs`, `tests/branding.mjs`, plus concurrent-reservation repetition (report ratio, per the oversell rule) and receipt access-control negatives.

## 8. Deployment readiness

- Acceptance Worker `0a2bfc57` is live behind Access; logo fix `93509da` (#5) awaits the GitHub Actions workflow, whose hardened version is PR #7 (the #6 version on `main` must not be given the token).
- Nothing in this spec is deployed. New migrations would apply to acceptance D1 only after review and separate approval.

## 9. Owner information still required

1. Real products: photos (with rights), descriptions, prices, opening stock per variant, brands, materials.
2. Shipping: rate per state/LGA (or weight bands), couriers, dispatch address, whether unrated destinations block checkout or go to a quotation workflow.
3. Reservation/unpaid-order expiry period for bank transfer.
4. Returns, exchanges, refunds, cancellation policy text.
5. Confirmation that Moniepoint account 7035963225 receives under the name "Afnan Collection".
6. `sales@` and `orders@` mailbox ownership; Resend domain verification (DNS approval).
7. Who may approve payments: `admin` only, or a separate payments role.
8. Approval to create a private receipts R2 bucket.
9. Shoe-size system(s) to support (EU/UK/US).

## 10. Recommended increments (one PR each)

1. Taxonomy & product fields (departments, subcategories, 11 age bands, brand/material/dimensions) + storefront filters.
2. Media improvements (reorder, replace, variant photo, EXIF strip, thumbnails, orphan cleanup).
3. Bank-transfer checkout + private receipt upload + payment review + separate payment/fulfilment status.
4. Sales notification email with delivery log/retry (after sender verification).
5. Delivery: LGA capture, zone/LGA rates, couriers, tracking, dispatch events.
6. Inventory reporting: reserved/committed view, filters, low-stock alerts, CSV export/import.
