# Photo Portugal

Professional photographer marketplace for tourists visiting Portugal. Find and book local photographers for vacation photoshoots across 23+ stunning locations.

**Live:** [photoportugal.com](https://photoportugal.com)

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API routes, PostgreSQL 16
- **Auth:** NextAuth.js v5 (Auth.js) — Google OAuth + Email/Password
- **Real-time:** Server-Sent Events (SSE) for messaging
- **Hosting:** DigitalOcean Droplet (2vCPU, 4GB), Nginx, PM2, Let's Encrypt SSL
- **Images:** Unsplash CDN (location photos), local uploads (portfolio/avatars)
- **DNS/CDN:** Cloudflare (optional, currently direct)

## Features

### For Tourists (Clients)
- Browse 23 photography locations across Portugal
- Filter photographers by location, shoot type, language, price, rating
- View photographer portfolios and verified reviews
- Book photoshoots with package selection, date/time picker
- Real-time messaging with photographers (SSE, Telegram-style UI)
- Leave reviews after completed sessions
- Client dashboard with booking management

### For Photographers
- Profile management (bio, languages, shoot types, 23 locations)
- Portfolio upload (plan-based limits: Free 10, Pro 50, Premium unlimited)
- Avatar upload
- Package creation (name, duration, photos, price, "Most Popular" flag)
- Incoming booking management (confirm/decline/complete)
- Real-time messaging with clients
- Settings: account, notifications, subscription
- Plans: Free (active), Pro $19/mo, Premium $39/mo (coming soon)

### Admin Panel
- Access: `/admin` (role: admin)
- Platform stats (users, photographers, bookings, reviews, messages)
- Photographer management: verify, feature, change plans
- All bookings overview with status
- User list with roles

### SEO
- Location landing pages optimized for "photographer in [city] portugal"
- Schema.org JSON-LD: WebSite, Organization, FAQPage, LocalBusiness, TouristDestination
- Dynamic sitemap (locations + DB photographers + demo)
- OpenGraph + Twitter card with custom OG image (1200x630)
- Canonical URLs on all pages
- robots.txt (disallow /dashboard, /api, /auth)
- Web manifest (PWA-ready)

### Pages
- `/` — Homepage with hero, search, locations, testimonials
- `/photographers` — Catalog with sidebar filters (DB + demo merge)
- `/photographers/[slug]` — Profile (DB or demo, revalidate 60s)
- `/locations` — All 23 locations
- `/locations/[slug]` — Location detail with hero photo
- `/book/[slug]` — Booking flow
- `/dashboard` — Auto-redirect by role
- `/dashboard/photographer` — Photographer dashboard (tabs: bookings, profile, portfolio, packages)
- `/dashboard/client` — Client dashboard (bookings + reviews)
- `/dashboard/messages` — Real-time chat (sidebar + chat panel)
- `/dashboard/settings` — Account, notifications, subscription
- `/admin` — Admin panel
- `/pricing` — Plans comparison
- `/faq` — FAQ with FAQPage schema
- `/about`, `/contact`, `/privacy`, `/terms`
- `/how-it-works`

## Development

```bash
npm install
npm run dev
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://photoportugal:PASSWORD@localhost:5432/photoportugal

# Auth
NEXTAUTH_URL=https://photoportugal.com
NEXTAUTH_SECRET=<random-secret>
AUTH_URL=https://photoportugal.com
AUTH_TRUST_HOST=true

# Google OAuth
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Stripe Connect
STRIPE_SECRET_KEY=sk_test_xxx (or sk_live_xxx for production)
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# SMTP
SMTP_HOST=smtp.migadu.com
SMTP_PORT=465
SMTP_USER=info@photoportugal.com
SMTP_PASS=<smtp-password>
```

**Important:** On the production server, env vars are passed via PM2 ecosystem config (`ecosystem.config.cjs`), NOT from `.env` file. Next.js does not auto-load `.env` in production when started via PM2.

## Database

Schema: `db/schema.sql`

Tables: users, photographer_profiles, photographer_locations, packages, portfolio_items, bookings, reviews, review_photos, messages, notification_preferences, managed_locations

Enums: user_role (client, photographer, admin), plan_type, booking_status (inquiry, pending, confirmed, completed, delivered, cancelled), payment_status

## Stripe Connect

Platform account: Portugal (Express accounts for photographers).

### Payment Flow
1. Photographer connects Stripe Express account from Dashboard → Subscription
2. Client books → photographer confirms → client sees "Pay" button
3. Payment: package price + 10% service fee
4. Stripe splits: photographer gets payout, platform gets service fee + commission
5. Commission: Free 20%, Pro 12%, Premium 7%

### Webhooks
- URL: `https://photoportugal.com/api/stripe/webhook`
- Events: payment_intent.succeeded/failed, account.updated, checkout.session.completed
- Secrets stored in ecosystem.config.cjs on server (never commit to git)

### Switching to Live
1. Replace `sk_test_` / `pk_test_` with `sk_live_` / `pk_live_` in ecosystem.config.cjs
2. Replace `STRIPE_WEBHOOK_SECRET` with live webhook secret
3. Restart PM2: `pm2 delete photoportugal && pm2 start ecosystem.config.cjs && pm2 save`

## Cron Jobs

Daily at 8 AM UTC (`/var/www/photoportugal/scripts/run-cron.sh`):
- 24h booking reminder (emails both client and photographer)
- Auto review request (3 days after completed/delivered)

```bash
psql -U photoportugal -d photoportugal -f db/schema.sql
```

### Admin User
The admin user is created directly in the DB:
```sql
INSERT INTO users (email, name, password_hash, role, email_verified)
VALUES ('info@photoportugal.com', 'Admin', '<bcrypt-hash>', 'admin', TRUE);
```

## Deployment

Server: DO Droplet (146.190.166.142)

```bash
# SSH to server
ssh root@146.190.166.142

# Deploy
cd /var/www/photoportugal
git pull origin main
npm run build
pm2 restart photoportugal

# PM2 config
pm2 start ecosystem.config.cjs
pm2 save

# SSL (Let's Encrypt, auto-renews)
certbot --nginx -d photoportugal.com -d www.photoportugal.com

# Nginx config
/etc/nginx/sites-available/photoportugal

# Uploads directory
/var/www/photoportugal/uploads/ (portfolio/, avatars/)

# DB credentials
/root/.db_credentials
```

## Project Structure

```
src/
  app/
    admin/            # Admin panel (server + client components)
    api/
      admin/          # Admin API (photographer management)
      auth/           # Auth routes (register, set-role)
      bookings/       # Booking CRUD + status updates
      dashboard/      # Profile, portfolio, packages, avatar APIs
      messages/       # Messages + SSE stream + conversations
      photographers/  # Public photographer data API
      reviews/        # Review creation
    auth/             # Sign in, sign up, auth layout (noindex)
    book/             # Booking flow (/book/[slug])
    dashboard/
      client/         # Client dashboard
      messages/       # Real-time chat UI
      photographer/   # Photographer dashboard
      settings/       # Account settings
    locations/        # Location pages (23 cities)
    photographers/    # Catalog + profiles (DB + demo)
    about/, contact/, faq/, pricing/, privacy/, terms/, how-it-works/
  components/
    layout/           # Header (dropdown menu), Footer
    photographers/    # PhotographerCard
    providers/        # SessionProvider
    ui/               # LocationCard, HeroSearchBar, ReviewForm, HowItWorks, Testimonials
  lib/
    auth.ts           # NextAuth config (Google + Credentials, callbacks)
    db.ts             # PostgreSQL pool (query, queryOne helpers)
    demo-data.ts      # Demo photographers and reviews
    locations-data.ts # 23 location definitions
    unsplash-images.ts # Image URLs with Retina (dpr=2) support
  types/
    index.ts          # TypeScript interfaces
db/
  schema.sql          # Canonical database schema
public/
  logo.svg            # Brand logo (SVG)
  og-image.png        # Social sharing image (1200x630)
  hero-family.webp    # Hero section main photo
  favicon.*, icon-*   # Favicons and PWA icons
  manifest.json       # Web manifest
```

## Key Architecture Decisions

1. **Demo + DB merge**: Photographer catalog shows both demo photographers (for SEO/showcase) and real DB profiles. Demo data used as fallback when DB is empty.

2. **SSE for messaging**: Server-Sent Events with 1-second polling for real-time chat. Simpler than WebSockets, works with Next.js API routes. Auto-reconnect on disconnect.

3. **Unsplash CDN for location images**: No local image processing. Unsplash handles WebP/AVIF, resizing, and CDN. `dpr=2` for Retina displays.

4. **PM2 ecosystem config for env vars**: Next.js doesn't auto-load `.env` in production when spawned by PM2. All env vars must be in `ecosystem.config.cjs`.

5. **Role-based access**: Dashboard routing reads role from DB (not JWT) to handle stale tokens after role changes. Auth pages redirect logged-in users.

6. **ISR for profiles**: `revalidate = 60` on photographer profile pages so new packages/changes appear within a minute without rebuild.
