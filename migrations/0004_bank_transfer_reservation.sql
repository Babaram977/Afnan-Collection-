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
