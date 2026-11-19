-- Additive and backwards-compatible: retain all accounts, business data and session rows.
-- Legacy sessions must reauthenticate before receiving password-mode administration rights.
ALTER TABLE session ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'legacy'
 CHECK(auth_method IN ('legacy','password','email_otp'));
