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
