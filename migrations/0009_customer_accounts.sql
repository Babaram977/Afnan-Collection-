-- Additive, fail-closed customer accounts. Completely separate from privileged Better Auth staff identities.
-- No existing order, payment, stock or administrator record is changed.
CREATE TABLE customer_account_profiles (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 verified_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE customer_account_challenges (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE,
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0,1)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX customer_account_challenge_email ON customer_account_challenges(email,created_at);
CREATE TABLE customer_account_sessions (
 token_hash TEXT PRIMARY KEY,
 customer_id TEXT NOT NULL REFERENCES customer_account_profiles(id),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX customer_account_sessions_owner ON customer_account_sessions(customer_id,expires_at);
CREATE TABLE customer_order_links (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 customer_id TEXT NOT NULL REFERENCES customer_account_profiles(id),
 linked_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX customer_order_links_owner ON customer_order_links(customer_id,linked_at DESC);
