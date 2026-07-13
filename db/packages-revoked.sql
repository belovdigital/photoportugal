-- 2026-07-13: custom proposals can be withdrawn by the photographer.
-- DELETE /api/messages/share-package sets revoked_at; the chat card
-- flips to "Offer withdrawn" on both sides and bookings POST refuses
-- revoked packages. Catalog packages are unaffected (photographers
-- delete those from Studio as before).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
