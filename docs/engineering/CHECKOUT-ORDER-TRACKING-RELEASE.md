# Order tracking, WhatsApp hand-off and admin notifications — release readiness

**Status: code complete on `feat/order-tracking-notifications`. Not deployed. Migration 0008 is not
applied anywhere. Checkout stays disabled in production.**

## What this adds (on top of PR #41, live as `8ed6e8a`)

| Area | Behaviour |
|---|---|
| Order page `/order/$id` | Reopens an order on the device that placed it (guest-order cookie; another device gets "not found"). Shows status from the saved order only, the saved items with selections, delivery or pickup, totals, bank details and receipt upload while awaiting transfer, and a refresh button. |
| `/orders` | Orders placed from this browser, each with its status. No account or sign-in. |
| Checkout | "Track this order" link after the order is prepared; the order id is remembered on the device before the cart is cleared. |
| WhatsApp | "Send Payment Receipt via WhatsApp" opens `wa.me/2347035963225` with the order reference and exact amount only: no address, phone, token or storage link. The customer attaches the receipt themselves. Website upload stays available. |
| Transfer reference | Optional field with the receipt (3-120 safe characters), stored as evidence only. Payment review shows it and flags any other order that used the same reference. |
| Bank reference replay | A bank transaction reference can settle only one order: a clear 409 naming the first order, backed by a unique index for concurrent attempts. |
| Admin inbox | Bell with unread count in Store Management, a list of events with order reference, amount and time, links to Orders or Payment review, mark read / mark all read, 20-second refresh while open. Optional browser alerts after explicit permission, while Store Management is open in that browser. |
| Events | order created, receipt uploaded, payment verified, late payment, receipt rejected, cancelled, expired, processing, shipped, delivered. Each is written in the same database transaction as the change, only when the change really happened; ids are deterministic, so retries add nothing. Fulfilment staff see only fulfilment events (payment verified and later). |
| Staff email | New order, receipt uploaded and late payment are emailed to `sales@afnancollectionkn.com` through a durable outbox: retried with backoff (up to 6 attempts), claimed before sending so it is never sent twice, Resend `Idempotency-Key` set. No customer details, receipt files or links in the email. A failed email never affects the order, payment or stock. |
| Guest cookie | 90 days (was 7), so a customer can follow an order to delivery on the same device. |

## Not built (deliberately)

- **Background Web Push** when the portal is closed: needs a service worker, VAPID keys and real
  iPhone home-screen testing. Not claimed. Browser alerts work only while the portal is open.
- **Customer emails**: the plan keeps them off until the sender and mailbox are verified. Customer
  messages are shown on the order page instead.

## Schema: migration 0008 (additive)

`payment_receipts.transfer_reference` (+ index), unique index on normalised
`bank_transfer_approvals.bank_reference`, tables `admin_events` and `email_outbox`. No existing row
changes. Production has no approvals yet, so the unique index cannot conflict. The legacy
`notifications` table is kept for history and no longer written.

## Release sequence (each step needs owner approval)

1. Review and merge this PR (CI green on the exact head).
2. Acceptance: migrations 0007 and 0008 are both pending there; apply with an acceptance migration
   workflow, then let the acceptance deploy run.
3. Production: a `migrate-production-0008.yml` written after merge (same safeguards as 0007,
   pinned to the merge commit and the 0008 checksum), dispatched by the owner, verified.
4. Production deploy of the merge commit with `checkout=disabled`, `email_sender=unverified`.
5. Checkout activation is a separate decision. Before it: the owner confirms a test credit to
   Moniepoint 7035963225 (Afnan Collection), the sales mailbox and sender domain are verified, delivery
   zone names are corrected, and policy pages have approved text.

Rollback: redeploy the previous Worker version recorded by the deploy workflow. The 0008 schema is
additive and unused by the previous version, so it can stay in place.

## Evidence

- `tests/order-tracking.mjs` (64 checks, added to CI). It covers:
  - one event per real transition and none for failures or repeats;
  - outbox delivery and retry without duplicates;
  - fulfilment visibility;
  - read state;
  - transfer reference validation, storage and duplicate flagging;
  - bank reference replay (API and index);
  - expiry and late payment;
  - a 390 px browser journey through checkout, the order page after reload, receipt with
    reference, WhatsApp link, `/orders`, another-device refusal and the admin inbox.
- Mutation check: with the replay pre-check removed, the test fails, and the unique index still
  blocks the replay.
- Full local suite on the branch head (see the PR).
