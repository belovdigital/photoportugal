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
  password_hash VARCHAR(255), -- null if Google-only
  role user_role NOT NULL DEFAULT 'client',
  avatar_url TEXT,
  google_id VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);

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
  languages TEXT[] DEFAULT '{}',
  shoot_types TEXT[] DEFAULT '{}',
  hourly_rate INTEGER, -- in EUR (whole euros)
  currency VARCHAR(3) DEFAULT 'EUR',
  experience_years INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  verification_requested_at TIMESTAMP,
  plan plan_type DEFAULT 'free',
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
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_photographer ON portfolio_items(photographer_id);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id),
  package_id UUID REFERENCES packages(id),
  location_slug VARCHAR(100),
  status booking_status DEFAULT 'pending',
  shoot_date DATE,
  shoot_time TIME,
  message TEXT, -- initial message from client
  total_price INTEGER, -- in EUR (whole euros)
  payment_status payment_status DEFAULT 'pending',
  group_size INTEGER,
  occasion VARCHAR(100),
  stripe_payment_intent_id VARCHAR(255),
  delivery_token VARCHAR(64) UNIQUE,
  delivery_password VARCHAR(10),
  delivery_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_photographer ON bookings(photographer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE UNIQUE INDEX idx_bookings_delivery_token ON bookings(delivery_token) WHERE delivery_token IS NOT NULL;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
  client_id UUID NOT NULL REFERENCES users(id),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  text TEXT,
  photos_public BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT TRUE, -- verified because tied to a real booking
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
  text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_booking ON messages(booking_id);

-- ============================================================
-- DELIVERY PHOTOS (photos delivered to client per booking)
-- ============================================================
CREATE TABLE delivery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_photos_booking ON delivery_photos(booking_id);

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
