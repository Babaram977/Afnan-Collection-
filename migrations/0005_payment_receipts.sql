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
