# Production migration 0008 and checkout-activation readiness (2026-11-23)

**Status: workflow prepared, not dispatched. Production unchanged (ledger 0001–0007, checkout off).**

## Verified state (read-only)

| Item                 | Evidence                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main                 | `434cec4` (merge of #44). Application code is identical to `a29ddcf` (#43); #44 changed only workflows, tests and docs.                                                                     |
| Main CI              | run 45088952568: success on `434cec4`                                                                                                                                                       |
| Acceptance migration | run 45089249042: success on `434cec4`. Acceptance D1 ledger 0001–0008, all 0008 objects present, data preserved (1 user/staff, 11 categories, 62 audit), quick_check ok, 0 FK violations.   |
| Acceptance deploy    | run 45089621006: success (automatic, so acceptance checkout stays **disabled**)                                                                                                             |
| Production deploy    | run 45089960253: skipped (automatic production deploys are gated off)                                                                                                                       |
| Production D1        | ledger 0001–0007; 11 products, 13 variants, 189 units; 0 orders and 0 approvals; **0 duplicate bank references**, so the 0008 unique index cannot conflict; quick_check ok, 0 FK violations |
| Production health    | `checkoutEnabled: false`, `paymentsEnabled: false`                                                                                                                                          |

## `migrate-production-0008.yml`

- Applies only `0008_order_tracking_notifications.sql` to `afnan-collection-production`.
- Pinned to `434cec4`, with the 0007/0008 checksums pinned.
- **Release gates:** owner dispatch from `main` in the `afnan-production` environment. The pinned release must have passed exact-release CI (45088952568), **and** the acceptance 0007+0008 migration (45089249042), **and** the acceptance deploy (45089621006), so production only receives a migration already proven on acceptance.
- **Isolation:** D1 UUID and name are verified, and the target must not be the acceptance database. A Time Travel bookmark is captured first.
- **State machine:** the run proceeds from 0001–0007 (apply 0008) or 0001–0008 (nothing to do). Anything else stops it, and 0008's schema objects must agree with the ledger.
- **Pre-condition:** existing bank references must be unique.
- **After:**
  - ledger 0001–0008 with nothing pending;
  - the exact new column; inbox and outbox tables; the bank-reference index present and unique;
  - integrity ok and 0 FK violations;
  - unchanged: users, staff, sessions, catalogue, stock, receipts, approvals, categories, banners,
    history and zones;
  - orders (including delivery/pickup flags) and order lines (including colour/size selections)
    unchanged row by row;
  - the inbox and outbox start empty.

### Offline validation (`simulate.py`)

| Scenario                                | Result                                             |
| --------------------------------------- | -------------------------------------------------- |
| A. production shape at 0007             | applies 0008; all checks pass                      |
| B. rerun after success                  | nothing applied; all checks pass                   |
| C. database still at 0006               | **stops** (snapshot query fails before any change) |
| D. 0008 table added by hand             | **stops before any change**                        |
| E. 0008 column added by hand            | **stops before any change**                        |
| F. duplicate bank references            | **stops before any change**                        |
| G. stock changed during the run         | after-check fails                                  |
| H. a pickup flag changed during the run | after-check fails                                  |
| I. a selection changed during the run   | after-check fails                                  |

### Rollback

- A stop condition means nothing changed.
- To undo after success: restore production D1 to the pre-action bookmark in the run summary
  (`wrangler d1 time-travel restore`), with owner approval.
- 0008 is additive and the current production Worker (`8ed6e8a`) does not use it, so the migration can
  precede the deploy safely.
- Deploy rollback: the deploy workflow records the previous Worker version.

## Release order (each step needs owner approval)

1. Merge this PR.
2. Dispatch `migrate-production-0008.yml`.
3. Dispatch `deploy-production.yml` for `434cec4` with `checkout=disabled` and `email_sender=unverified`
   (as today). This makes the order page, WhatsApp hand-off, inbox and outbox live while checkout
   stays off.
4. Activate checkout only after the checklist below.

## Before checkout activation: what remains, with evidence

### 1. Hosted order lifecycle on acceptance (needs the owner)

Acceptance is behind Cloudflare Access (HTTP 401 to automated clients), and that is correct. Claude
cannot complete a hosted order there without access, and will not bypass it. Acceptance also has **no
products and no active zones**, and its checkout is disabled.

The owner (signed in to Access) can run this, or grant Claude an Access service token for acceptance
only:

1. Dispatch `deploy-acceptance.yml` for `434cec4` with `acceptance_checkout=enabled` (acceptance only;
   card payments stay disabled).
2. In acceptance `/admin`, add one clearly labelled test product (for example "ACCEPTANCE TEST ITEM",
   price ₦1,000, stock 5, two colours) and publish it.
3. On a phone:
   - add both colours to the bag and check out with State = Kano. The confirmation shows ₦2,000 + ₦1,500
     delivery = ₦3,500, Moniepoint Microfinance Bank, Afnan Collection, 7035963225, and a 24-hour
     deadline;
   - tap "Track this order", reload, and see "Awaiting Transfer";
   - tap "Send Payment Receipt via WhatsApp": the message shows the reference and ₦3,500 only;
   - upload a screenshot with a transfer reference, and see "Receipt Submitted".
4. In acceptance `/admin`:
   - the bell shows "New order placed" and "Payment receipt uploaded";
   - Payment review shows the reference;
   - **approve with a made-up bank reference** (no money moves on acceptance), and the order page shows
     "Paid";
   - try the same bank reference on a second test order: it is refused, naming the first order;
   - cancel a third test order: stock returns.
5. Redeploy acceptance with `acceptance_checkout=disabled`.

### 2. Delivery configuration (owner decision)

The checkout no longer shows the zones list. Delivery is priced only by the approved policy: Kano
₦1,500, free from ₦250,000, interstate paid to the carrier, pickup free.

The three active production zones ("Kano Metropoli" ₦1,500, "Eastern Kano Hotoro" ₦1,500, "Westarn
Kano Rijiyar Zaki" ₦2,000) are still accepted by a backwards-compatibility API path kept in PR #41. A
crafted request naming a zone would be charged that zone's fee: ₦2,000 for "Westarn", and no free
delivery from ₦250,000. No page sends such a request.

**Recommendation:** before activation, untick "Available for checkout" on those three zones in
`/admin` → Zones. Nothing on the storefront uses them, and this closes the path. Alternatively, approve
a small code change removing the legacy path.

### 3. Staff email (owner action)

Public DNS:

- **Inbound** `sales@` goes to `mail.afnancollectionkn.com`, with SPF `v=spf1 mx ip4:192.154.254.25 ~all`.
- **Outbound:** a Resend DKIM key (`resend._domainkey`) is published.
- The `send.` subdomain records point to `forge.rmta.net`, which is not the standard Resend values.
- DMARC `p=none`.

Confirm in the Resend dashboard that `afnancollectionkn.com` shows **Verified**, then send one test.
Until `email_sender=verified` is deployed, staff emails are recorded as "unconfigured" in the outbox
and retried, and the admin inbox still shows every event.

### 4. Customer-facing payment instructions

The values come from `src/lib/business.ts`: Moniepoint Microfinance Bank / Afnan Collection /
7035963225, owner-confirmed 2026-11-22. Covered by tests: confirmation page, order page, copy button
and WhatsApp text (`bank-transfer`, `order-tracking`). The owner should read the live acceptance
confirmation once during step 1 (wording, deadline in Nigeria time).

### 5. Other open items

- Policy pages (returns, delivery, privacy): production `content` table is empty; approved text is
  needed.
- A real iPhone check of checkout, the order page and the WhatsApp hand-off (automated tests use
  emulated browsers only).
- A first real reconciliation: the first live order's credit is confirmed in Moniepoint before approval
  (the admin form requires the exact amount and bank reference).
