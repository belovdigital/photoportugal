-- Flag for admin-owned test accounts (the founder's QA/seed accounts).
-- Bookings made by these users should be excluded from any business
-- metrics: leaderboards, revenue dashboards, funnel reports, GMV.
--
-- We don't ban these accounts (is_banned is a different thing — that
-- means "denied login"). is_test_account just means "don't count this
-- in stats." The accounts can still sign in normally.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_is_test_account
  ON users (is_test_account) WHERE is_test_account = TRUE;

-- Seed known test accounts. Add more here as discovered.
UPDATE users SET is_test_account = TRUE
 WHERE email IN (
   'nekto.komilfo@gmail.com',
   'alex@belov.pt',
   'a@lob.lol'
 );
