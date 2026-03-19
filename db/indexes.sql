-- Additional indexes for performance (March 2026 audit)
CREATE INDEX IF NOT EXISTS idx_photographer_user ON photographer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_delivery_accepted ON bookings(delivery_accepted) WHERE delivery_accepted = FALSE;
