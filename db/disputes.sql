-- Disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  client_id UUID NOT NULL REFERENCES users(id),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id),
  reason VARCHAR(50) NOT NULL, -- 'fewer_photos', 'wrong_location', 'technical_issues', 'no_show', 'other'
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'under_review', 'resolved', 'rejected'
  resolution VARCHAR(20), -- 'reshoot', 'partial_refund', 'full_refund', 'rejected'
  resolution_note TEXT,
  refund_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);
