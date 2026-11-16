-- DESTRUCTIVE. Separate owner approval only, after a fresh D1 bookmark and an encrypted export of these rows.
-- Stage A test orders are exactly the orders placed with the Stage A test zone (the only active zone during Stage A).
-- R2 receipt objects must be deleted separately: list payment_receipts.object_key for these orders BEFORE running this.
-- Children first, so foreign keys stay satisfied.
DELETE FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM payment_receipts WHERE order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM bank_transfer_approvals WHERE order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM inventory_movements WHERE variant_id='a0000000-0000-4000-8000-00000000a003' OR order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001');
DELETE FROM orders WHERE zone_id='a0000000-0000-4000-8000-00000000a001';
DELETE FROM carts WHERE lines LIKE '%a0000000-0000-4000-8000-00000000a003%';
DELETE FROM variants WHERE id='a0000000-0000-4000-8000-00000000a003';
DELETE FROM products WHERE id='a0000000-0000-4000-8000-00000000a002';
DELETE FROM zones WHERE id='a0000000-0000-4000-8000-00000000a001';
INSERT INTO audit(actor,action,entity_id,detail) VALUES('operator:acceptance-stage-a','acceptance.test_data.removed','stage-a','{}');
