-- Blind/quick bookings have no package, so nothing records how many photos
-- the client should expect. The assigned photographer commits a number in
-- their dashboard; it renders to the client and feeds the delivery
-- minimum-photos guard. Safe to run multiple times.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promised_photos INTEGER;
COMMENT ON COLUMN bookings.promised_photos IS 'Photo count the assigned photographer committed to deliver (blind/no-package bookings); feeds the delivery guard';
