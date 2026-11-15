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
