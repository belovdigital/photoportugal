-- Market tag on the tables a future merge would have to concatenate (2026-08-09).
--
-- Not to be confused with `visitor_sessions.country` / `concierge_chats.country`,
-- which already exist and mean something else entirely: the visitor's geo-IP
-- country from `cf-ipcountry`, nullable, no default. This one is the MARKET the
-- row belongs to — pt / es / it — and it is never null.
--
-- Why it exists at all: docs/MARKETS.md §1 fixed "separate databases per market"
-- with the compromise that a `country` column goes in from day one, so that
-- merging markets one day is a data copy rather than a schema redesign. That
-- was honoured on the Spanish and Italian databases when they were bootstrapped
-- and never applied to Portugal — i.e. the insurance was standing on the two
-- empty databases and missing on the one holding every real row. This closes it.
--
-- No code reads these columns yet, on any market. It is deliberately a no-op:
-- DEFAULT + NOT NULL means every existing row and every future INSERT gets the
-- right value without a single query changing.
--
-- Run once per market, with that market's own code:
--
--   psql "$DATABASE_URL" -v market=pt -f db/market-country-column.sql
--
-- Safe to re-run: IF NOT EXISTS everywhere. On Spain and Italy it is already
-- satisfied and does nothing.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT :'market';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT :'market';

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT :'market';
