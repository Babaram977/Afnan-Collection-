-- Internal inactive zones satisfy legacy orders.zone_id FK; never appear in public active zone lists.
-- Do not apply remotely without an approved backup and migration verification.
INSERT OR IGNORE INTO zones(id,name,state,fee_kobo,active) VALUES
('c3b0d60b-bbc3-4542-958a-f81b5f6e50fd','Internal store pickup','Kano',0,0),
('3c28076b-0e9f-4c76-97c5-e52d07aa2b8e','Internal Kano delivery','Kano',0,0),
('4dce8f67-efc6-472d-89ce-66396973e985','Internal direct-pay interstate transport','Other states',0,0);
ALTER TABLE orders ADD COLUMN fulfilment_method TEXT NOT NULL DEFAULT 'delivery' CHECK(fulfilment_method IN ('delivery','pickup'));
ALTER TABLE orders ADD COLUMN carrier_paid_direct INTEGER NOT NULL DEFAULT 0 CHECK(carrier_paid_direct IN (0,1));
