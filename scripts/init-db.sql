-- Photo Portugal Database Schema
-- Run as: psql -U photoportugal -d photoportugal -f scripts/init-db.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'photographer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE photographer_plan AS ENUM ('free', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portfolio_type AS ENUM ('photo', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role user_role NOT NULL DEFAULT 'client',
  avatar_url TEXT,
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(255) NOT NULL,
  description TEXT,
  long_description TEXT,
  cover_image TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  seo_title VARCHAR(255),
  seo_description TEXT
);

-- Photographer profiles
CREATE TABLE IF NOT EXISTS photographer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  tagline VARCHAR(500),
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  languages TEXT[] DEFAULT '{}',
  hourly_rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'EUR',
  experience_years INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  plan photographer_plan DEFAULT 'free',
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INT DEFAULT 0,
  session_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photographer ↔ Location (many-to-many)
CREATE TABLE IF NOT EXISTS photographer_locations (
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (photographer_id, location_id)
);

-- Packages
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  num_photos INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_popular BOOLEAN DEFAULT FALSE,
  "order" INT DEFAULT 0
);

-- Portfolio items
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  type portfolio_type NOT NULL DEFAULT 'photo',
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  text TEXT,
  photos TEXT[] DEFAULT '{}',
  photos_public BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_items_photographer ON portfolio_items(photographer_id, "order");
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_photographer_date ON bookings(photographer_id, date);
CREATE INDEX IF NOT EXISTS idx_reviews_photographer ON reviews(photographer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id, created_at);

-- Seed locations
INSERT INTO locations (id, slug, name, region, description, long_description, cover_image, lat, lng, seo_title, seo_description)
VALUES
  (uuid_generate_v4(), 'lisbon', 'Lisbon', 'Greater Lisbon', 'Capture unforgettable moments in Europe''s sunniest capital — cobblestone streets, colorful azulejo tiles, and stunning riverside views.', 'Lisbon is a photographer''s dream. From the narrow, winding streets of Alfama adorned with traditional azulejo tiles to the panoramic viewpoints (miradouros) offering sweeping views of the Tagus River, every corner tells a story.', '/images/locations/lisbon-cover.jpg', 38.7223, -9.1393, 'Photographer in Lisbon, Portugal | Book a Professional Photoshoot', 'Find the best photographers in Lisbon, Portugal. Book a professional vacation photoshoot in iconic locations.'),
  (uuid_generate_v4(), 'porto', 'Porto', 'Northern Portugal', 'The romantic northern gem — baroque architecture, Douro River sunsets, and the iconic Ribeira waterfront.', 'Porto enchants with its dramatic riverside setting, medieval architecture, and world-famous port wine cellars.', '/images/locations/porto-cover.jpg', 41.1579, -8.6291, 'Photographer in Porto, Portugal | Professional Vacation Photoshoots', 'Book a professional photographer in Porto, Portugal.'),
  (uuid_generate_v4(), 'algarve', 'Algarve', 'Southern Portugal', 'Dramatic golden cliffs, turquoise waters, and hidden sea caves — the Algarve is nature''s perfect photo studio.', 'The Algarve coast is one of Europe''s most photogenic destinations.', '/images/locations/algarve-cover.jpg', 37.0179, -7.9304, 'Photographer in Algarve, Portugal | Beach & Cliff Photoshoots', 'Book a professional photographer in the Algarve, Portugal.'),
  (uuid_generate_v4(), 'sintra', 'Sintra', 'Greater Lisbon', 'A fairytale world of enchanted palaces, mystical forests, and romantic gardens just outside Lisbon.', 'Sintra feels like stepping into a fairy tale.', '/images/locations/sintra-cover.jpg', 38.7874, -9.3903, 'Photographer in Sintra, Portugal | Fairytale Palace Photoshoots', 'Book a photographer in Sintra, Portugal.'),
  (uuid_generate_v4(), 'madeira', 'Madeira', 'Madeira Islands', 'The floating garden of the Atlantic — volcanic peaks, levada trails, and lush tropical landscapes.', 'Madeira Island is a paradise for nature lovers and adventure seekers.', '/images/locations/madeira-cover.jpg', 32.6669, -16.9241, 'Photographer in Madeira, Portugal | Nature & Adventure Photoshoots', 'Find professional photographers in Madeira, Portugal.'),
  (uuid_generate_v4(), 'cascais', 'Cascais', 'Greater Lisbon', 'A chic coastal town with sandy beaches, dramatic Atlantic cliffs, and elegant 19th-century architecture.', 'Cascais combines seaside charm with cosmopolitan elegance.', '/images/locations/cascais-cover.jpg', 38.6979, -9.4215, 'Photographer in Cascais, Portugal | Coastal Photoshoots Near Lisbon', 'Book a professional photographer in Cascais, Portugal.'),
  (uuid_generate_v4(), 'azores', 'Azores', 'Azores Islands', 'Remote volcanic islands with emerald crater lakes, hot springs, and the most dramatic landscapes in Europe.', 'The Azores archipelago is one of Europe''s best-kept secrets.', '/images/locations/azores-cover.jpg', 37.7833, -25.5, 'Photographer in the Azores, Portugal | Volcanic Island Photoshoots', 'Find professional photographers in the Azores, Portugal.')
ON CONFLICT (slug) DO NOTHING;
