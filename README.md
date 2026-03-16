# Photo Portugal

Professional photographer marketplace for tourists visiting Portugal. Find and book local photographers for vacation photoshoots across 23+ stunning locations.

**Live:** [photoportugal.com](https://photoportugal.com)

## Stack

- **Frontend:** Next.js 16, React, Tailwind CSS 4
- **Backend:** Next.js API routes, PostgreSQL
- **Auth:** NextAuth.js v5 (Google OAuth + Email/Password)
- **Hosting:** DigitalOcean Droplet, Nginx, PM2, Let's Encrypt SSL
- **Images:** Unsplash CDN (location photos), local uploads (portfolio)

## Features

### For Tourists
- Browse 23 photography locations across Portugal
- Filter photographers by location, shoot type, language, price, rating
- View photographer portfolios and verified reviews
- Book photoshoots with package selection, date/time picker
- Real-time messaging with photographers
- Client dashboard with booking management

### For Photographers
- Profile management (bio, languages, shoot types, locations)
- Portfolio upload with plan-based limits
- Package creation (name, duration, photos, price)
- Incoming booking management (confirm/decline/complete)
- Messaging with clients
- Plans: Free, Pro ($19/mo), Premium ($39/mo)

### SEO
- Location landing pages optimized for "photographer in [city] portugal"
- Schema.org JSON-LD (LocalBusiness, TouristDestination)
- Dynamic sitemap with all locations and photographers
- OpenGraph + Twitter card metadata

## Development

```bash
npm install
npm run dev
```

## Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/photoportugal
NEXTAUTH_URL=https://photoportugal.com
NEXTAUTH_SECRET=<random-secret>
AUTH_URL=https://photoportugal.com
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

## Database

Schema: `db/schema.sql`

```bash
psql -U photoportugal -d photoportugal -f db/schema.sql
```

## Deployment

Server: DO Droplet (146.190.166.142), PM2 ecosystem config.

```bash
# On server
cd /var/www/photoportugal
git pull origin main
npm run build
pm2 restart photoportugal
```

## Project Structure

```
src/
  app/
    api/          # API routes (auth, bookings, messages, dashboard)
    auth/         # Sign in, sign up pages
    book/         # Booking flow
    dashboard/    # Client + photographer dashboards, messaging
    locations/    # Location pages (23 cities)
    photographers/ # Catalog + individual profiles
  components/     # Reusable UI components
  lib/            # Auth, DB, data helpers
  types/          # TypeScript types
db/
  schema.sql      # PostgreSQL schema
public/
  logo.svg        # Brand logo
  favicon.*       # Favicons
```
