ALTER TABLE products ADD COLUMN deleted_at INTEGER;
ALTER TABLE variants ADD COLUMN sale_price_kobo INTEGER CHECK(sale_price_kobo IS NULL OR (typeof(sale_price_kobo)='integer' AND sale_price_kobo>0 AND sale_price_kobo<price_kobo));
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)));
DROP TRIGGER reserve_stock;
CREATE TRIGGER reserve_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=NEW.variant_id AND p.status='active' AND p.deleted_at IS NULL AND v.stock>=NEW.qty AND COALESCE(v.sale_price_kobo,v.price_kobo)=NEW.price_kobo) THEN RAISE(ABORT,'Stock or price changed') END;
 UPDATE variants SET stock=stock-NEW.qty WHERE id=NEW.variant_id;
 INSERT INTO inventory_movements(variant_id,delta,reason,order_id,actor) VALUES(NEW.variant_id,-NEW.qty,'reservation',NEW.order_id,'checkout');
END;
