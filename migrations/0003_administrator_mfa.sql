-- Additive migration. Existing staff lose privileged access until controlled enrollment.
CREATE TABLE admin_security (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('pending','active','recovery','disabled')),
 epoch INTEGER NOT NULL DEFAULT 1 CHECK(epoch > 0),
 approval_ref TEXT NOT NULL,
 verified_by TEXT NOT NULL,
 verified_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE admin_credentials (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES admin_security(user_id) ON DELETE CASCADE,
 public_key TEXT NOT NULL,
 counter INTEGER NOT NULL CHECK(counter >= 0),
 transports TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(transports)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX admin_credentials_user ON admin_credentials(user_id);
CREATE TABLE admin_challenges (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES admin_security(user_id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
 epoch INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('register','authenticate')),
 challenge TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX admin_challenges_expiry ON admin_challenges(expires_at);
CREATE TABLE admin_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES admin_security(user_id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
 epoch INTEGER NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','fulfilment')),
 verified_at INTEGER NOT NULL DEFAULT(unixepoch()),
 last_seen INTEGER NOT NULL DEFAULT(unixepoch()),
 expires_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE admin_recovery_codes (
 code_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES admin_security(user_id) ON DELETE CASCADE,
 used_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX admin_recovery_user ON admin_recovery_codes(user_id);
CREATE TABLE auth_cooldowns (key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX auth_cooldowns_expiry ON auth_cooldowns(expires_at);
-- Privilege changes cannot reuse a previously issued primary or MFA session.
CREATE TRIGGER staff_role_security_change AFTER UPDATE OF role ON staff WHEN OLD.role<>NEW.role BEGIN
 UPDATE admin_security SET epoch=epoch+1 WHERE user_id=NEW.user_id;
 DELETE FROM admin_sessions WHERE user_id=NEW.user_id;
 DELETE FROM admin_challenges WHERE user_id=NEW.user_id;
 DELETE FROM session WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER staff_security_removal AFTER DELETE ON staff BEGIN
 UPDATE admin_security SET state='disabled',epoch=epoch+1 WHERE user_id=OLD.user_id;
 DELETE FROM admin_sessions WHERE user_id=OLD.user_id;
 DELETE FROM admin_challenges WHERE user_id=OLD.user_id;
 DELETE FROM session WHERE user_id=OLD.user_id;
END;
