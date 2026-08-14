# Photo Portugal — Architecture

## Overview

Photo Portugal is a photographer marketplace connecting English-speaking tourists visiting Portugal with local professional photographers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend & Backend | Next.js 16 (App Router, Server Components) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (on the market's own box) |
| Auth | NextAuth.js (Google OAuth + Email/Password) |
| File Storage | Cloudflare R2 (`files.<domain>` CDN) — avatars, portfolio, delivery, WebP-ladder variants; legacy `/var/www/<app>/uploads` still serves old files |
| Process Manager | PM2 |
| Web Server | Nginx (reverse proxy) |
| CDN / DNS / SSL | Cloudflare |
| Hosting | Hetzner Cloud — one box per market (PT / ES / IT), see docs/MARKETS.md |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   ├── auth/               # Sign in / Sign up pages
│   ├── dashboard/          # Photographer & Client dashboards
│   ├── how-it-works/       # Static info page
│   ├── locations/          # Location listing + [slug] detail pages
│   ├── photographers/      # Photographer listing + [slug] profile pages
│   ├── globals.css         # Tailwind theme + base styles
│   ├── layout.tsx          # Root layout (fonts, header, footer)
│   ├── page.tsx            # Homepage
│   ├── robots.ts           # robots.txt generation
│   └── sitemap.ts          # sitemap.xml generation
├── components/
│   ├── layout/             # Header, Footer
│   ├── photographers/      # PhotographerCard
│   ├── reviews/            # Review components (TBD)
│   └── ui/                 # Reusable UI components
├── lib/                    # Utilities, data, DB client
│   ├── demo-data.ts        # Demo photographers & reviews
│   └── locations-data.ts   # Location definitions
└── types/                  # TypeScript type definitions
```

## SEO Strategy

- **SSG** for location pages and photographer profiles (generateStaticParams)
- **Schema.org** structured data: TouristDestination, LocalBusiness, AggregateRating
- **Semantic URLs**: `/locations/lisbon`, `/photographers/maria-santos`
- **Meta tags** with templates: `%s | Photo Portugal`
- **Sitemap** auto-generated from data
- **robots.txt** blocks dashboard/api/auth from indexing

## Deployment

- `scripts/deploy.sh <pt|es|it|all>` — rsync from the Mac into `<app>-incoming/`,
  then the server's `/var/www/deploy.sh` builds into the inactive blue/green slot
  and switches only on a passing health check. There is no git on the servers.
- Nginx proxies the active slot (port 3000 or 3001 — read `<app>-active`), handles static caching
- Cloudflare handles SSL termination, CDN, and DNS

## Database Schema

Schema: `db/schema.sql` (generated from prod — refresh with `scripts/refresh-schema.sh`); semantics: `docs/DOMAIN.md`.

## Color Palette

- **Primary** (terracotta red): brand color, CTAs, accents
- **Accent** (forest green): verification badges, success states
- **Warm** (sandy beige): backgrounds, borders, subtle UI
- **Font Display**: Playfair Display (headings)
- **Font Sans**: Inter (body)
