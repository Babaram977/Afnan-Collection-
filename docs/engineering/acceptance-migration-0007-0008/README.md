# Acceptance migrations 0007 + 0008 — readiness, safeguards and recovery

**Status: prepared, not executed.** The workflow `migrate-acceptance-0007-0008.yml` exists only on
this PR branch. It runs only when the repository owner dispatches it from `main` after the PR is
merged. Nothing has been applied to any remote database. No deployment has been made.

## Acceptance today (read-only inspection, 2026-11-22)

|                           | Acceptance                                                                                               | Production                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Worker                    | `afnan-collection-storefront` (workers.dev only, no routes)                                              | `afnan-collection-production` (custom domains) |
| D1                        | `afnan-collection-acceptance` `11950c2f-14bb-4a31-9add-356f155dea4e`                                     | `afnan-collection-production` `73ddfc46-…`     |
| R2                        | `afnan-product-media-acceptance`, `afnan-payment-receipts-acceptance`                                    | `…-production`                                 |
| Ledger                    | 0001–0006                                                                                                | 0001–0007                                      |
| 0007/0008 objects present | none (no partial migration)                                                                              | 0007 only                                      |
| Data                      | 1 user / staff / session / account, 11 categories, 62 audit rows, 0 products, orders, zones or approvals | live catalogue                                 |
| Integrity                 | quick_check ok, 0 FK violations                                                                          | ok                                             |

Acceptance and production share no database, bucket, Worker or hostname. The workflow hard-codes the
acceptance database and also asserts the target is not the production database UUID.

## What the workflow applies

`0007_fulfilment_options.sql` and then `0008_order_tracking_notifications.sql`, through
`wrangler d1 migrations apply` (the D1 ledger records each). Release pinned to `a29ddcf` (main after
PR #43), whose CI run `45077162618` passed; 0006/0007/0008 checksums pinned.

## Safeguards

1. **Who and where:** owner dispatch from `main` only. The `afnan-acceptance` environment must forbid
   admin bypass and allow only `main`. Exact-release CI must have passed. Serialised with acceptance
   deploys.
2. **What:** only `migrations/` from the pinned release is packaged, and checksums are verified twice.
   The job holding the Cloudflare token runs no application code.
3. **Identity:** D1 UUID and name are checked through the Cloudflare API, and the target must not be
   the production database.
4. **Recovery:** a Time Travel bookmark is captured before any change and written to the run summary.
5. **Ledger state machine:** the run proceeds only from 0001–0006 (apply both), 0001–0007 (an earlier
   run stopped after 0007: apply 0008 only) or 0001–0008 (nothing to do). Each migration's schema
   objects must agree with the ledger; any partial or manual change stops the run before it alters
   anything.
6. **Pre-conditions:** the internal zone ids must be unused before 0007, and existing bank references
   must be unique before 0008.
7. **After:**
   - ledger 0001–0008 with nothing pending;
   - exact column definitions; inbox and outbox tables present; the bank-reference index present and
     unique;
   - integrity ok and 0 FK violations;
   - unchanged: users, staff, accounts, catalogue, stock, orders, order lines, receipts, approvals,
     categories, banners, history, sessions, orders and lines row by row, variant stock and prices,
     and existing zones;
   - the internal zones are inactive and free, and the inbox, outbox and references start empty.
8. **Privacy:** no contact details, tokens or password hashes are selected. Evidence is summarised and
   the work directory deleted.

## Offline validation (`simulate.py`)

Runs the workflow's own SQL and verification scripts against SQLite copies of the schema seeded with
representative data: owner account, categories, catalogue, zone, pending/paid/expired orders, a
receipt and an approval.

| Scenario                                      | Result                             |
| --------------------------------------------- | ---------------------------------- |
| A. fresh 0006 database                        | applies both; all checks pass      |
| B. 0007 already applied                       | applies 0008 only; all checks pass |
| C. rerun after success                        | nothing applied; all checks pass   |
| D. 0007 column added by hand, no ledger entry | **stops before any change**        |
| E. 0008 table added by hand, ledger at 0007   | **stops before any change**        |
| F. duplicate bank references                  | **stops before any change**        |
| G. internal zone id already taken             | **stops before any change**        |
| H. stock changed during the run               | after-check fails                  |
| I. an order changed during the run            | after-check fails                  |

Run: `python3 docs/engineering/acceptance-migration-0007-0008/simulate.py` (needs Python with PyYAML,
and Node).

## Lifecycle on upgraded data (`tests/migration-upgrade.mjs`, in CI)

The test starts from the 0006 schema with data written the old way: pending, paid (with an approval
and receipt) and expired orders, real stock reservations through the trigger, and a legacy staff
notification. It then applies 0007 and 0008 and proves:

- all legacy rows and stock are preserved, with integrity and foreign keys clean;
- a returning guest reopens a legacy order with its cookie, and another device gets 404;
- new visitors get the 90-day `HttpOnly; SameSite=Lax` guest cookie;
- a receipt with a transfer reference on a legacy order works, and cancelling it restores its 2 units;
- a new pickup order with two colour selections reserves stock and records both selections;
- payment review shows the reference, and reusing the **pre-upgrade** bank reference is refused,
  naming the legacy order; approval works;
- a legacy expired order takes a late-review decision without re-reserving stock;
- the inbox receives every event, staff email is delivered once, and a failed email is retried once.

WhatsApp hand-off, browser notifications, accessibility and the 390 px journeys are covered by
`tests/order-tracking.mjs` and the existing browser suites.

## Rollback and recovery

- **Before any change** (stop conditions): nothing has changed. Fix the cause and dispatch again.
- **After 0007 but before 0008** (e.g. 0008 fails): the ledger records 0007. A rerun applies only 0008.
- **To undo:** restore the acceptance D1 to the pre-action bookmark in the run summary, with
  `wrangler d1 time-travel restore DB --bookmark <bookmark>` against `afnan-collection-acceptance`.
  This is an acceptance-only, owner-approved action, and restores data and schema exactly. Both
  migrations are additive, so the previous Worker version also runs against the migrated schema.
- **Deploy rollback:** the acceptance deploy workflow records the live version before deploying.

## Release requirements still open

1. Owner approval to merge this PR. After merge, the automatic acceptance deploy will **refuse** at
   its pending-migrations gate (safe; nothing deploys).
2. Owner dispatch of `migrate-acceptance-0007-0008.yml` with an approval reference.
3. Owner-approved acceptance deploy (manual dispatch of `deploy-acceptance.yml` for `a29ddcf` or
   later, checkout disabled) once migrations show none pending.
4. Production 0008 migration and deploy: separate approval and workflow.
5. Before any checkout activation:
   - a verified test credit to Moniepoint 7035963225 (Afnan Collection);
   - a verified sales mailbox and sender;
   - corrected delivery zone names;
   - approved policy text;
   - a real iPhone check.
