PRAGMA foreign_keys = ON;
CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE session (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE INDEX session_user_idx ON session(user_id);
CREATE TABLE account (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX account_user_idx ON account(user_id);
CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER, updated_at INTEGER);
CREATE INDEX verification_identifier_idx ON verification(identifier);
CREATE TABLE staff (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('admin','fulfilment')));
CREATE TABLE categories (slug TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL REFERENCES categories(slug), description TEXT NOT NULL DEFAULT '', age_groups TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(age_groups)), images TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(images)), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')), featured INTEGER NOT NULL DEFAULT 0, seasonal INTEGER NOT NULL DEFAULT 0, age_guidance TEXT NOT NULL DEFAULT '', safety_notes TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX products_public_idx ON products(status,category);
CREATE TABLE variants (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), sku TEXT NOT NULL UNIQUE, size TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', price_kobo INTEGER NOT NULL CHECK(typeof(price_kobo)='integer' AND price_kobo>=0 AND price_kobo<=1000000000), stock INTEGER NOT NULL DEFAULT 0 CHECK(typeof(stock)='integer' AND stock>=0), low_stock INTEGER NOT NULL DEFAULT 3 CHECK(low_stock>=0));
CREATE INDEX variants_product_idx ON variants(product_id);
CREATE TABLE zones (id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL, fee_kobo INTEGER NOT NULL CHECK(typeof(fee_kobo)='integer' AND fee_kobo>=0 AND fee_kobo<=100000000), active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)));
CREATE TABLE orders (id TEXT PRIMARY KEY, owner TEXT NOT NULL, user_id TEXT REFERENCES user(id), idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, email TEXT NOT NULL, customer TEXT NOT NULL CHECK(json_valid(customer)), address TEXT NOT NULL CHECK(json_valid(address)), zone_id TEXT NOT NULL REFERENCES zones(id), delivery_kobo INTEGER NOT NULL CHECK(delivery_kobo>=0), total_kobo INTEGER NOT NULL DEFAULT 0 CHECK(total_kobo>=0), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','processing','shipped','delivered','cancelled','expired','refund_pending','refunded')), created_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER NOT NULL DEFAULT (unixepoch()+1800), UNIQUE(owner,idempotency_key));
CREATE INDEX orders_owner_idx ON orders(owner,created_at);
CREATE INDEX orders_expiry_idx ON orders(status,expires_at);
CREATE TABLE order_items (order_id TEXT NOT NULL REFERENCES orders(id), variant_id TEXT NOT NULL REFERENCES variants(id), name TEXT NOT NULL, sku TEXT NOT NULL, price_kobo INTEGER NOT NULL CHECK(price_kobo>=0), qty INTEGER NOT NULL CHECK(typeof(qty)='integer' AND qty BETWEEN 1 AND 99), PRIMARY KEY(order_id,variant_id));
CREATE TABLE inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id TEXT NOT NULL REFERENCES variants(id), delta INTEGER NOT NULL, reason TEXT NOT NULL, order_id TEXT REFERENCES orders(id), actor TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE INDEX movements_variant_idx ON inventory_movements(variant_id,created_at);
CREATE TRIGGER reserve_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=NEW.variant_id AND p.status='active' AND v.stock>=NEW.qty AND v.price_kobo=NEW.price_kobo) THEN RAISE(ABORT,'Stock or price changed') END;
 UPDATE variants SET stock=stock-NEW.qty WHERE id=NEW.variant_id;
 INSERT INTO inventory_movements(variant_id,delta,reason,order_id,actor) VALUES(NEW.variant_id,-NEW.qty,'reservation',NEW.order_id,'checkout');
END;
CREATE TRIGGER restore_stock AFTER UPDATE OF status ON orders WHEN OLD.status='pending' AND NEW.status IN ('cancelled','expired') BEGIN
 UPDATE variants SET stock=stock+(SELECT qty FROM order_items WHERE order_id=NEW.id AND variant_id=variants.id) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=NEW.id);
 INSERT INTO inventory_movements(variant_id,delta,reason,order_id,actor) SELECT variant_id,qty,NEW.status,NEW.id,'order-service' FROM order_items WHERE order_id=NEW.id;
END;
CREATE TABLE payments (reference TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), amount_kobo INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency='NGN'), status TEXT NOT NULL CHECK(status IN ('initialized','paid','failed','refund_pending','refunded','review')), provider_id TEXT UNIQUE, refund_id TEXT UNIQUE, authorization_url TEXT, updated_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE payment_events (id TEXT PRIMARY KEY, reference TEXT NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE addresses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, label TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE INDEX addresses_user_idx ON addresses(user_id);
CREATE TABLE carts (owner TEXT PRIMARY KEY, lines TEXT NOT NULL CHECK(json_valid(lines)), updated_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE banners (id TEXT PRIMARY KEY, title TEXT NOT NULL, href TEXT NOT NULL, image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0);
CREATE TABLE content (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
-- Navigation labels are supplied by the approved UI, not fabricated merchandise.
INSERT INTO categories VALUES ('clothing','Clothing'),('shoes','Shoes'),('accessories','Accessories'),('diapers','Diapers'),('feeding','Feeding'),('nursery','Blankets & Nursery'),('toys','Toys & Learning'),('books','Books'),('bath-care','Bath & Care'),('school','School Essentials'),('gifts','Gifts');
-- No delivery prices or active zones are invented. Staff must configure these.
