-- Photo count per curated match option (2026-08-05).
--
-- Picking one of these options creates a CONFIRMED, payable booking with no
-- package_id, so before this column there was no number anywhere on it: the
-- delivery guard had nothing to enforce and the client was never told what to
-- expect. The admin sets it next to the price when curating the options.
ALTER TABLE match_request_photographers
  ADD COLUMN IF NOT EXISTS num_photos INTEGER;
