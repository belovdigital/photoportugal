# Photo Portugal — Database Schema

## Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| name | VARCHAR(255) | |
| password_hash | VARCHAR(255) | NULL for Google-only users |
| role | ENUM('client', 'photographer') | |
| avatar_url | TEXT | |
| google_id | VARCHAR(255) | NULL for email-only users |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### photographer_profiles
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | UNIQUE |
| slug | VARCHAR(255) UNIQUE | URL-friendly name |
| display_name | VARCHAR(255) | |
| tagline | VARCHAR(500) | |
| bio | TEXT | |
| avatar_url | TEXT | |
| cover_url | TEXT | |
| languages | TEXT[] | Array of language names |
| hourly_rate | DECIMAL(10,2) | |
| currency | VARCHAR(3) | DEFAULT 'EUR' |
| experience_years | INT | |
| is_verified | BOOLEAN | DEFAULT FALSE |
| is_featured | BOOLEAN | DEFAULT FALSE |
| plan | ENUM('free', 'pro', 'premium') | DEFAULT 'free' |
| rating | DECIMAL(2,1) | Computed average |
| review_count | INT | DEFAULT 0 |
| session_count | INT | DEFAULT 0 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### locations
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | VARCHAR(255) UNIQUE | |
| name | VARCHAR(255) | |
| region | VARCHAR(255) | |
| description | TEXT | Short description |
| long_description | TEXT | Full SEO text |
| cover_image | TEXT | |
| lat | DECIMAL(9,6) | |
| lng | DECIMAL(9,6) | |
| seo_title | VARCHAR(255) | |
| seo_description | TEXT | |

### photographer_locations (join table)
| Column | Type | Notes |
|--------|------|-------|
| photographer_id | UUID FK | |
| location_id | UUID FK | |
| PRIMARY KEY | (photographer_id, location_id) | |

### packages
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| photographer_id | UUID FK | |
| name | VARCHAR(255) | |
| description | TEXT | |
| duration_minutes | INT | |
| num_photos | INT | |
| price | DECIMAL(10,2) | |
| is_popular | BOOLEAN | DEFAULT FALSE |
| order | INT | Display order |

### portfolio_items
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| photographer_id | UUID FK | |
| type | ENUM('photo', 'video') | |
| url | TEXT | Path to file |
| thumbnail_url | TEXT | |
| caption | TEXT | |
| location_id | UUID FK | Optional |
| order | INT | Display order |
| created_at | TIMESTAMPTZ | |

### bookings
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| client_id | UUID FK → users | |
| photographer_id | UUID FK | |
| package_id | UUID FK | Optional |
| location_id | UUID FK | Optional |
| date | DATE | |
| time | TIME | |
| duration_minutes | INT | |
| status | ENUM('pending', 'confirmed', 'completed', 'cancelled') | |
| total_price | DECIMAL(10,2) | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### reviews
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| booking_id | UUID FK UNIQUE | One review per booking |
| client_id | UUID FK → users | |
| photographer_id | UUID FK | |
| rating | INT | 1-5 |
| title | VARCHAR(255) | |
| text | TEXT | |
| photos | TEXT[] | Optional client photos |
| photos_public | BOOLEAN | DEFAULT FALSE |
| is_verified | BOOLEAN | TRUE if booking was completed |
| created_at | TIMESTAMPTZ | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| booking_id | UUID FK | |
| sender_id | UUID FK → users | |
| text | TEXT | |
| read_at | TIMESTAMPTZ | NULL = unread |
| created_at | TIMESTAMPTZ | |

## Indexes

- `users(email)` — UNIQUE
- `photographer_profiles(slug)` — UNIQUE
- `photographer_profiles(user_id)` — UNIQUE
- `locations(slug)` — UNIQUE
- `portfolio_items(photographer_id, order)`
- `bookings(client_id, status)`
- `bookings(photographer_id, date)`
- `reviews(photographer_id, created_at)`
