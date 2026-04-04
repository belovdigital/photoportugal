-- Photo Portugal Database Schema
-- PostgreSQL 16

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE user_role AS ENUM ('client', 'photographer', 'admin');
CREATE TYPE plan_type AS ENUM ('free', 'pro', 'premium');
CREATE TYPE booking_status AS ENUM ('inquiry', 'pending', 'confirmed', 'completed', 'delivered', 'cancelled', 'disputed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  password_hash VARCHAR(255), -- null if Google-only
  role user_role NOT NULL DEFAULT 'client',
  avatar_url TEXT,
  google_id VARCHAR(255) UNIQUE,
  apple_id VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMPTZ,
  phone VARCHAR(20),
  stripe_customer_id VARCHAR(255),
  is_banned BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_apple_id ON users(apple_id);

-- ============================================================
-- PHOTOGRAPHER PROFILES
-- ============================================================
CREATE TABLE photographer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  tagline VARCHAR(500),
  bio TEXT,
  cover_url TEXT,
  cover_position_y INTEGER DEFAULT 50,
  languages TEXT[] DEFAULT '{}',
  shoot_types TEXT[] DEFAULT '{}',
  hourly_rate INTEGER, -- in EUR (whole euros)
  currency VARCHAR(3) DEFAULT 'EUR',
  experience_years INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verification_code VARCHAR(6),
  phone_verification_sent_at TIMESTAMP,
  plan plan_type DEFAULT 'free',
  registration_number INTEGER,
  is_founding BOOLEAN DEFAULT FALSE,
  early_bird_tier VARCHAR(20), -- 'founding', 'early50', 'first100'
  early_bird_expires_at TIMESTAMPTZ, -- NULL = never expires (founding)
  onboarding_completed BOOLEAN DEFAULT FALSE,
  is_test BOOLEAN DEFAULT FALSE,
  stripe_account_id VARCHAR(255),
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_subscription_id VARCHAR(255),
  verification_requested_at TIMESTAMPTZ,
  telegram_chat_id TEXT,
  rating NUMERIC(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photographer_slug ON photographer_profiles(slug);
CREATE INDEX idx_photographer_user ON photographer_profiles(user_id);
CREATE INDEX idx_photographer_rating ON photographer_profiles(rating DESC);
CREATE INDEX idx_photographer_plan ON photographer_profiles(plan);

-- ============================================================
-- PHOTOGRAPHER <-> LOCATION (many-to-many)
-- ============================================================
CREATE TABLE photographer_locations (
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  location_slug VARCHAR(100) NOT NULL,
  PRIMARY KEY (photographer_id, location_slug)
);

CREATE INDEX idx_photoloc_location ON photographer_locations(location_slug);

-- ============================================================
-- PACKAGES
-- ============================================================
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  num_photos INTEGER NOT NULL,
  price INTEGER NOT NULL, -- in EUR (whole euros)
  is_popular BOOLEAN DEFAULT FALSE,
  delivery_days INTEGER DEFAULT 7,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_photographer ON packages(photographer_id);

-- ============================================================
-- PORTFOLIO ITEMS (photos & videos)
-- ============================================================
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('photo', 'video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  location_slug VARCHAR(100),
  shoot_type VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_photographer ON portfolio_items(photographer_id);

-- ============================================================
-- SLUG REDIRECTS (old photographer slugs → current profile)
-- ============================================================
CREATE TABLE slug_redirects (
  old_slug VARCHAR(255) PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PHOTOGRAPHER UNAVAILABILITY
-- ============================================================
CREATE TABLE photographer_unavailability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_unavailability_photographer ON photographer_unavailability(photographer_id);
CREATE INDEX idx_unavailability_dates ON photographer_unavailability(date_from, date_to);

-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id),
  package_id UUID REFERENCES packages(id),
  location_slug VARCHAR(100),
  location_detail TEXT,              -- free-text meeting point / specific area
  status booking_status DEFAULT 'pending',
  shoot_date DATE,
  shoot_time VARCHAR(50),
  flexible_date_from DATE, -- when flexible: earliest available date
  flexible_date_to DATE,   -- when flexible: latest available date
  proposed_date DATE, -- date proposed by one party during negotiation
  proposed_by VARCHAR(20), -- 'photographer' or 'client'
  date_note TEXT, -- reason/comment for date change
  message TEXT, -- initial message from client
  total_price INTEGER, -- in EUR (whole euros)
  payment_status payment_status DEFAULT 'pending',
  group_size INTEGER,
  occasion VARCHAR(100),
  stripe_payment_intent_id VARCHAR(255),
  service_fee NUMERIC,
  platform_fee NUMERIC,
  payout_amount NUMERIC,
  payment_url TEXT,
  delivery_token VARCHAR(64) UNIQUE,
  delivery_password VARCHAR(64),
  delivery_expires_at TIMESTAMPTZ,
  delivery_accepted BOOLEAN DEFAULT FALSE,
  delivery_accepted_at TIMESTAMPTZ,
  payout_transferred BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  payment_reminder_sent BOOLEAN DEFAULT FALSE,
  shoot_reminder_sent BOOLEAN DEFAULT FALSE,
  delivery_reminder_sent BOOLEAN DEFAULT FALSE,
  review_requested BOOLEAN DEFAULT FALSE,
  trustpilot_sent BOOLEAN DEFAULT FALSE,
  session_reminder_sent BOOLEAN DEFAULT FALSE,
  delivery_review_reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_delivery_accepted ON bookings(delivery_accepted) WHERE delivery_accepted = FALSE;
CREATE INDEX idx_bookings_photographer ON bookings(photographer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE UNIQUE INDEX idx_bookings_delivery_token ON bookings(delivery_token) WHERE delivery_token IS NOT NULL;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id), -- NULL for admin-created reviews
  client_id UUID REFERENCES users(id), -- NULL for admin-created reviews
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  text TEXT,
  video_url TEXT,
  photos_public BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT TRUE, -- verified because tied to a real booking
  is_approved BOOLEAN DEFAULT TRUE,
  client_name_override VARCHAR(255), -- for admin-created reviews without a real client
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_photographer ON reviews(photographer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================================
-- REVIEW PHOTOS (optional, consent-based)
-- ============================================================
CREATE TABLE review_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE, -- client controls visibility
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (between client and photographer per booking)
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  text TEXT,
  media_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_system BOOLEAN DEFAULT FALSE,
  CONSTRAINT messages_content_check CHECK (text IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX idx_messages_booking ON messages(booking_id);

-- ============================================================
-- DELIVERY PHOTOS (photos delivered to client per booking)
-- ============================================================
CREATE TABLE delivery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  preview_url TEXT,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_photos_booking ON delivery_photos(booking_id);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_bookings BOOLEAN DEFAULT TRUE,
  email_messages BOOLEAN DEFAULT TRUE,
  email_reviews BOOLEAN DEFAULT TRUE,
  sms_bookings BOOLEAN DEFAULT TRUE,
  telegram_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLATFORM SETTINGS (key-value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER photographer_profiles_updated_at
  BEFORE UPDATE ON photographer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  meta_title VARCHAR(200),
  meta_description VARCHAR(300),
  target_keywords TEXT,
  author VARCHAR(200) DEFAULT 'Photo Portugal',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DISPUTES
-- ============================================================
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

-- ============================================================
-- MANAGED LOCATIONS (admin-managed location pages)
-- ============================================================
CREATE TABLE IF NOT EXISTS managed_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(100) NOT NULL,
  description TEXT,
  long_description TEXT,
  cover_image_url TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  seo_title VARCHAR(200),
  seo_description VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER managed_locations_updated_at
  BEFORE UPDATE ON managed_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
