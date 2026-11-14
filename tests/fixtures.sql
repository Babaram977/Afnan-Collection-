CREATE TABLE test_outbox (email TEXT PRIMARY KEY, code TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE test_provider_transactions (reference TEXT PRIMARY KEY, amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, provider_id TEXT NOT NULL);
