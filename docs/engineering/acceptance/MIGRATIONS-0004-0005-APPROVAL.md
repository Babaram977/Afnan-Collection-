# Acceptance migration approval package: 0004 and 0005

Prepared 2026-11-15 for owner review. **Nothing in this document has been executed against the acceptance database.** Applying it requires separate, explicit owner approval. Scope is the acceptance D1 only (`afnan-collection-acceptance`, `11950c2f-14bb-4a31-9add-356f155dea4e`). No production database exists, and no other business's resources are involved.

## 0. Refresh — 2026-11-15T06:30:56Z (read-only)

| Check | Result |
|---|---|
| Time Travel bookmark (reference) | `00000017-00000000-00005124-5f0279ecc64ed770c0c5935e81491dc5` |
| Ledger / data / integrity | 0001–0003 · 0 orders, users, products, staff · `quick_check` ok |
| `wrangler d1 migrations list DB --remote` | Pending: exactly `0004_bank_transfer_reservation.sql`, `0005_payment_receipts.sql` |
| `0004` checksum | `00a07af1…a9e637`, identical on `main` (merged in #8, `c719bfd`) |
| `0005` checksum | `11974ae5…b33059`, arrives with #9 (head `3d7fe5b`) |
| Live Worker | `2ca5f17b-dcd0-46cd-bdd0-e86608b08981`, deployed 06:23:25Z by the hardened #7 workflow from commit `93509da` (message "acceptance 93509da: Protected deployment approval test…"); bindings include `RECEIPTS`; checkout/payments off; Access deny-all + service token |

**New prerequisite: PR #5 (logo fix) must be merged before any deployment from `main`.** The live code (`93509da`) exists only on `fix/logo-path`. `main`, and so #8 and #9, still reference `/brand/IMG_8842(1).png`, which Cloudflare's asset service returns as 404. Deploying from `main` without #5 would break the logo again.

## 1. Earlier state (read-only, captured 2026-11-15T05:30:42Z)

| Check | Result |
|---|---|
| Migration ledger (`d1_migrations`) | `0001_commerce.sql`, `0002_admin_management.sql`, `0003_administrator_mfa.sql` |
| Data | 0 orders, 0 users, 0 products, 0 staff |
| `PRAGMA quick_check` | `ok` |
| Schema objects (tables, triggers, indexes) | 47 |
| Time Travel bookmark | `00000014-00000000-00005124-51f71e8d6afcd3380ecca2d5c76140a6` |

D1 bookmarks advance with ordinary activity, including read queries; a read 15 minutes earlier returned `…0013…`. **This bookmark is a reference only. A fresh one is captured immediately before applying (step 3.2) and is the actual recovery point.**

## 2. What is applied

| File | SHA-256 | Origin |
|---|---|---|
| `migrations/0004_bank_transfer_reservation.sql` | `00a07af18cc2646dccc4902c8da416744e248dfb9b291f22891dc1d48aa9e637` | PR #8 |
| `migrations/0005_payment_receipts.sql` | `11974ae5b8b7e97eaf2950e5f49bd86362636ff1378d4891c7ef6cdd6ce33059` | PR #9 |

Both are additive: they create tables, indexes and triggers and add two nullable or defaulted columns to `orders`. They do not rewrite or delete existing rows. The checksums are re-verified before applying; any difference stops the procedure.

### 2.1 `0004_bank_transfer_reservation.sql` (complete)

```sql
-- Owner-approved 2026-11-15: manual bank transfer with a 24-hour payment window.
-- Existing orders keep the Paystack 30-minute behaviour (payment_method defaults to 'paystack').
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'paystack' CHECK(payment_method IN ('paystack','bank_transfer'));
-- Short customer-facing order reference, e.g. AC-20261116-0001 (Africa/Lagos date + daily sequence).
-- The UUID stays the internal identifier; the reference is for display and support only and never
-- grants access to an order (it is sequential, so it is guessable by design).
ALTER TABLE orders ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX orders_reference_idx ON orders(reference) WHERE reference IS NOT NULL;
CREATE TABLE order_reference_counters (day TEXT PRIMARY KEY CHECK(length(day)=8 AND day NOT GLOB '*[^0-9]*'), last INTEGER NOT NULL CHECK(typeof(last)='integer' AND last>0));
-- One staff decision per bank-transfer order. The primary key makes a second, concurrent
-- approval fail atomically, so approval can never be applied (or audited) twice.
CREATE TABLE bank_transfer_approvals (order_id TEXT PRIMARY KEY REFERENCES orders(id), decision_id TEXT NOT NULL UNIQUE, amount_kobo INTEGER NOT NULL CHECK(typeof(amount_kobo)='integer' AND amount_kobo>=0), bank_reference TEXT NOT NULL CHECK(length(bank_reference) BETWEEN 1 AND 120), outcome TEXT NOT NULL CHECK(outcome IN ('paid','late_review')), approved_by TEXT NOT NULL, approved_at INTEGER NOT NULL);
-- A bank-transfer deadline is fixed at order creation: nothing (receipt upload included) may extend it.
CREATE TRIGGER bank_transfer_deadline_fixed BEFORE UPDATE OF expires_at ON orders WHEN OLD.payment_method='bank_transfer' AND NEW.expires_at>OLD.expires_at BEGIN
 SELECT RAISE(ABORT,'Bank transfer payment deadline cannot be extended');
END;
-- A bank-transfer order becomes paid only through a recorded 'paid' staff approval.
CREATE TRIGGER bank_transfer_paid_requires_approval BEFORE UPDATE OF status ON orders WHEN OLD.payment_method='bank_transfer' AND NEW.status='paid' AND NOT EXISTS (SELECT 1 FROM bank_transfer_approvals WHERE order_id=OLD.id AND outcome='paid') BEGIN
 SELECT RAISE(ABORT,'Bank transfer payment requires staff approval');
END;
```

### 2.2 `0005_payment_receipts.sql` (complete)

```sql
-- Owner-approved 2026-11-15: customer payment receipts for manual bank transfer, stored in the
-- private R2 bucket bound as RECEIPTS, reviewed by MFA-verified administrators.
-- Object keys are random and never leave the server; customers see only status.
CREATE TABLE payment_receipts (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','application/pdf')), bytes INTEGER NOT NULL CHECK(typeof(bytes)='integer' AND bytes>0 AND bytes<=5242880), sha256 TEXT NOT NULL CHECK(length(sha256)=64), status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','rejected','superseded')), submitted_at INTEGER NOT NULL, reviewed_by TEXT, reviewed_at INTEGER, review_note TEXT CHECK(review_note IS NULL OR length(review_note)<=500), UNIQUE(order_id,sha256));
CREATE INDEX payment_receipts_review_idx ON payment_receipts(status,submitted_at);
CREATE INDEX payment_receipts_order_idx ON payment_receipts(order_id,submitted_at);
-- A reviewed receipt keeps its decision: only 'submitted' receipts may change status.
CREATE TRIGGER payment_receipt_decision_final BEFORE UPDATE OF status ON payment_receipts WHEN OLD.status<>'submitted' BEGIN
 SELECT RAISE(ABORT,'Receipt decision is final');
END;
-- Staff notifications (e.g. payment evidence awaiting review). Records delivery state only:
-- no message bodies, receipt links or provider responses are stored.
CREATE TABLE notifications (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('payment_review')), order_id TEXT NOT NULL REFERENCES orders(id), recipient TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','unconfigured','test')), attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX notifications_status_idx ON notifications(status,created_at);
```

## 3. Apply procedure (only after approval)

1. **Preconditions:** PR #8 (merged, `c719bfd`), PR #9 and PR #5 are merged with passing CI. The files on `main` match the checksums above. Wrangler uses the reviewed acceptance config (`.wrangler/acceptance/wrangler.jsonc`, D1 `11950c2f-…`).
2. **Recovery point:** read and record the current bookmark (`GET …/d1/database/11950c2f-…/time_travel/bookmark`) immediately before applying.
3. **Dry check:** `wrangler d1 migrations list DB --remote --config .wrangler/acceptance/wrangler.jsonc` must list exactly 0004 and 0005 as pending.
4. **Apply:** `wrangler d1 migrations apply DB --remote --config .wrangler/acceptance/wrangler.jsonc`.
5. **Verify** (read-only queries):
   - The ledger shows 0001–0005.
   - `PRAGMA quick_check` = `ok` and `PRAGMA foreign_key_check` is empty.
   - `orders` has `payment_method` and `reference`.
   - Tables `bank_transfer_approvals`, `order_reference_counters`, `payment_receipts` and `notifications` exist.
   - The 3 new triggers exist.
   - A second `migrations list` reports nothing pending.
6. **Deploy:** only then deploy the matching application commit through the GitHub workflow (separate approval). The new code needs these columns, so the schema must come first.

Order matters: **schema, then code**. The currently deployed code works on the new schema (see 4.1), so there is no unsafe window between steps 4 and 6.

## 4. Rollback (three tiers; least destructive first)

**Live deployment check (2026-11-15T05:33Z, read-only):** the Worker is serving version **`54023cdd-7b70-4331-bf78-561a277e5ff3`** at 100% (deployment `0784161d-c875-4f8d-99ab-b7f5d89a22c7`, created 01:25:26Z, message "acceptance 93509da: logo-path fix"). That is commit `93509da` (PR #5), deployed through the GitHub workflow. The earlier version `0a2bfc57` (commit `2942789`) is no longer live. Its bindings were read back: acceptance variables, checkout and payments off, `AUTH_SECRET` (secret_text), D1 `11950c2f-…`, MEDIA, no RECEIPTS yet. Hosted `/brand/afnan-collection-logo.png` returns 200 with SHA-256 `d40111ef…cdc1`.

**Rule:** a rollback target is never taken from this document. Immediately before deploying, and again before any rollback, read `GET …/workers/scripts/afnan-collection-storefront/deployments` and record the live version ID, its commit (from the version message) and its bindings. That recorded version is the rollback target.

### 4.1 Code only (preferred; no data change)
Roll back the Worker to the version recorded immediately before deployment: `wrangler rollback <recorded-version-id>`, or redeploy its commit through the workflow. **As of 06:25Z that is `2ca5f17b-dcd0-46cd-bdd0-e86608b08981` (commit `93509da`).** It superseded `54023cdd` (same commit) at 06:23Z; `0a2bfc57` is two versions back.

**Verified:** the oldest application code involved, commit `2942789`, passes its own integration (85), acceptance (12) and security (77) suites against a database with 0001–0005 applied. Old code is unaffected by the new columns, tables and triggers, so the schema can stay in place. Commit `93509da` differs from `2942789` only in the logo filename and its branding test (PR #5), with no backend or schema code, so the same holds. Re-run this check against the recorded rollback commit if it is anything else.

### 4.2 Schema reversal (only if the schema itself must go; separate approval)

> **Destructive to payment records. Never automatic.** Once any payment testing has begun, these scripts delete receipt records, payment decisions (approvals and late reviews), staff notifications and customer-facing order references. Orders are kept, but their payment history is not. Before any reversal:
> 1. Use tier 4.1 first; it loses nothing.
> 2. Obtain explicit owner approval naming this step.
> 3. Export the affected tables (`wrangler d1 export afnan-collection-acceptance --remote --table payment_receipts --table bank_transfer_approvals --table notifications --table order_reference_counters`, plus the `orders` reference column), store the export encrypted outside Git, and verify it.
> 4. Record a fresh Time Travel bookmark.
>
> No script, workflow or runbook may run 4.2 as an automatic follow-up to a failed deployment.
Run `docs/engineering/acceptance/rollback/0005_payment_receipts.down.sql`, then `0004_bank_transfer_reservation.down.sql`, after 4.1. This deletes receipt metadata, notifications, payment decisions and order references; orders themselves are kept. **Receipt files in the private R2 bucket are not deleted by the SQL**; remove them separately if required.

```sql
-- 0005_payment_receipts.down.sql  (SHA-256 a6fba4a4123ab3a5075c7230d206e33e9dec0d1f151583a345c7d6fd593911f3)
-- Reverses migrations/0005_payment_receipts.sql. Acceptance only; run only with separate approval.
-- Deletes receipt metadata and notification records. Receipt files in the private R2 bucket are
-- NOT deleted by this script; remove them separately (they are unreachable without these rows).
DROP INDEX IF EXISTS notifications_status_idx;
DROP TABLE IF EXISTS notifications;
DROP TRIGGER IF EXISTS payment_receipt_decision_final;
DROP INDEX IF EXISTS payment_receipts_order_idx;
DROP INDEX IF EXISTS payment_receipts_review_idx;
DROP TABLE IF EXISTS payment_receipts;
DELETE FROM d1_migrations WHERE name='0005_payment_receipts.sql';
```

```sql
-- 0004_bank_transfer_reservation.down.sql  (SHA-256 2aaed91824220a4200c1d348d5c659d814553bf9b13658ca0b03dbbaf5ade426)
-- Reverses migrations/0004_bank_transfer_reservation.sql. Acceptance only; run only with separate
-- approval, and only after 0005 is reversed and a Worker version that does not use these columns
-- is deployed. Removes payment decisions and order references; orders themselves are kept.
DROP TRIGGER IF EXISTS bank_transfer_paid_requires_approval;
DROP TRIGGER IF EXISTS bank_transfer_deadline_fixed;
DROP TABLE IF EXISTS bank_transfer_approvals;
DROP TABLE IF EXISTS order_reference_counters;
DROP INDEX IF EXISTS orders_reference_idx;
ALTER TABLE orders DROP COLUMN reference;
ALTER TABLE orders DROP COLUMN payment_method;
DELETE FROM d1_migrations WHERE name='0004_bank_transfer_reservation.sql';
```

**Verified locally:**
- **SQLite 3.53**, with 0001–0005 applied, a bank-transfer order, a reference counter and a receipt row present:
  - after both down scripts, the schema is **identical** to a database that only ever had 0001–0003;
  - the ledger is back to 0001–0003, the order row is kept, and the integrity and foreign-key checks are clean;
  - 0004 and 0005 re-apply cleanly afterwards.
- **Cloudflare's local D1 runtime (workerd):** the same scripts remove every 0004/0005 object and both columns, with `quick_check` ok.

### 4.3 Point-in-time restore (last resort; separate approval)
`wrangler d1 time-travel restore afnan-collection-acceptance --bookmark=<bookmark recorded in step 3.2>`. This reverts **all** data written after the bookmark, not just the schema. Use it only if 4.1 and 4.2 are insufficient. While acceptance holds no real data the impact is small, but it is still irreversible for anything written since.

## 5. Not covered by this approval
Worker deployment, enabling checkout on acceptance, creating delivery zones or test products, and anything on production. Each needs its own approval.
