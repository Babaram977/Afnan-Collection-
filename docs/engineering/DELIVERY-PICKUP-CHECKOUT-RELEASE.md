# Afnan Collection checkout fulfilment changes — owner instructions 22 Nov 2026

This is a **development-only** checkout branch; no deployment, checkout enablement or live bank transfer has occurred.

## Owner-confirmed bank details
- Beneficiary: **Afnan Collection**
- Account: **7035963225**
- Institution: **Moniepoint Microfinance Bank**
- These values match `src/lib/business.ts` and were re-confirmed by the owner. Confirm a real credited transaction and operations access before release.

## Customer choices
- **Store pickup: FREE**, regardless of order value. No delivery address required; collection location and time arranged with the store.
- **Delivery within Kano State:** flat **₦1,500** for merchandise totals below ₦250,000; **free** on merchandise totals ₦250,000 or more (inclusive).
- **Other Nigerian states:** store collects the **merchandise subtotal only**. The customer independently settles the actual logistics/transport charge **directly with the chosen carrier**. It is not waived or included even if the merchandise total reaches ₦250,000.
- New checkout supports free-form state and address, not predefined zone selectors. Legacy `zoneId` requests are still supported for backwards-compatible tests/integration; new internal inactive zones satisfy the existing zone FK.
- Server computes and persists final fee from the actual order-item snapshots inside the same D1 batch. No client-supplied fee is trusted.
- Existing customer orders, payment approvals, stocked inventory and older zone prices are not rewritten by the additive migration.

## Current limitations and release requirements
- Live Afnan checkout remains gated by existing `CHECKOUT_ENABLED` / bank-transfer release controls.
- Bank recipient and operating policy must be checked in the production UI, and real-world fulfilment, pickup contact and interstate carrier coordination agreed before launch.
- Test the *exact* migration against an isolated populated D1 fixture and the browser checkout with Kano, interstate, pickup, promotions, expiry, idempotency, staff receipt validation, payment verification and rollback.
- Existing active delivery zones are retained for legacy orders; no production schema updates until separately approved.
- Preserve Afnan Collection branding, commerce authentication and Moniepoint details; do not copy Heroine secrets.
- Final release requires all exact-head CI, security tests and a separately approved deployment; creating or merging this PR must never auto-activate production checkout.
