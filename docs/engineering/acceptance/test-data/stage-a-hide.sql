-- Reversible: hides the Stage A test zone and product from the storefront. Orders, receipts and audit stay as evidence.
UPDATE zones SET active=0 WHERE id='a0000000-0000-4000-8000-00000000a001';
UPDATE products SET status='archived',deleted_at=unixepoch() WHERE id='a0000000-0000-4000-8000-00000000a002' AND deleted_at IS NULL;
INSERT INTO audit(actor,action,entity_id,detail) VALUES('operator:acceptance-stage-a','acceptance.test_data.hidden','stage-a','{}');
