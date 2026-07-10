-- B2B: business inquiry pipeline (2026-07-10).
-- Businesses (events, corporate, brand content) file a request; admins act as
-- a HUMAN concierge — negotiate, pick photographers, invoice. The platform is
-- the single counterparty for the business client.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS business_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  event_type VARCHAR(100),          -- corporate_event / conference / headshots / brand_content / other
  event_date DATE,
  location VARCHAR(200),
  headcount VARCHAR(50),            -- free-form: "50-100", "~20"
  message TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'business_page',  -- business_page / profile / photoshoots / homepage / concierge
  photographer_id UUID REFERENCES photographer_profiles(id) ON DELETE SET NULL,  -- set when filed from a profile
  status VARCHAR(20) NOT NULL DEFAULT 'new',             -- new / in_progress / quoted / won / lost
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_inquiries_status ON business_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_business_inquiries_created ON business_inquiries(created_at DESC);

-- Every photographer offers business shoots by default; the 'business' shoot
-- type doubles as the opt-out switch (untick it in dashboard shoot types →
-- gone from /photoshoots/business AND the profile quote card).
-- Stored as display label 'Business' — photographer_profiles.shoot_types
-- holds labels ("Couples", "Family"), not slugs.
UPDATE photographer_profiles
SET shoot_types = array_append(COALESCE(shoot_types, '{}'), 'Business')
WHERE NOT ('Business' = ANY(COALESCE(shoot_types, '{}')));
