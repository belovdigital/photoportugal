-- A second archive, for photographs bought after the fact (2026-08-05).
--
-- The main archive is built once at acceptance and never rebuilt: zip_ready is
-- set TRUE in one place and FALSE in none, and both rebuild paths require it to
-- be FALSE. Rather than unfreeze it — which would overwrite the same R2 key and
-- re-send the "your photos are ready" email — extras get their own file, their
-- own flag and their own rebuild, triggered by each purchase.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extras_zip_path TEXT,
  ADD COLUMN IF NOT EXISTS extras_zip_size BIGINT,
  ADD COLUMN IF NOT EXISTS extras_zip_ready BOOLEAN NOT NULL DEFAULT FALSE;
