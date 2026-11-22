-- Additive (2026-11-22): customer transfer references, bank-reference replay protection, the
-- administrator notification inbox and a durable, retryable email outbox. No existing row changes.

-- Optional reference the customer typed with their receipt (evidence only; never proof of payment).
ALTER TABLE payment_receipts ADD COLUMN transfer_reference TEXT CHECK(transfer_reference IS NULL OR length(transfer_reference) BETWEEN 3 AND 120);
CREATE INDEX payment_receipts_transfer_reference_idx ON payment_receipts(upper(trim(transfer_reference))) WHERE transfer_reference IS NOT NULL;

-- A bank transaction reference can settle at most one order: replaying it on another order fails.
CREATE UNIQUE INDEX bank_transfer_approvals_reference_idx ON bank_transfer_approvals(upper(trim(bank_reference)));

-- Administrator inbox. Event ids are deterministic (kind:subject), so a retried state change can
-- never add a second event. audience 'admin' = owner/admin only; 'staff' = admin and fulfilment.
-- Stores no customer contact details: staff open the order from the admin dashboard.
CREATE TABLE admin_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('order.created','receipt.uploaded','payment.verified','payment.late_review','receipt.rejected','order.cancelled','order.expired','order.processing','order.shipped','order.delivered')),
  order_id TEXT NOT NULL REFERENCES orders(id),
  audience TEXT NOT NULL CHECK(audience IN ('admin','staff')),
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  read_by TEXT
);
CREATE INDEX admin_events_feed_idx ON admin_events(created_at DESC);
CREATE INDEX admin_events_unread_idx ON admin_events(read_at, audience);

-- Email outbox: one row per event and recipient (UNIQUE), retried with backoff until delivered or
-- abandoned. Holds delivery state only; message text is rebuilt from the event when sending.
CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES admin_events(id),
  recipient TEXT NOT NULL CHECK(length(recipient) BETWEEN 3 AND 254),
  status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed','unconfigured','test','abandoned')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT CHECK(last_error IS NULL OR length(last_error) <= 60),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(event_id, recipient)
);
CREATE INDEX email_outbox_due_idx ON email_outbox(status, next_attempt_at);
