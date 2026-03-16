# Photo Portugal — Architecture

## Overview

Photo Portugal is a photographer marketplace connecting English-speaking tourists visiting Portugal with local professional photographers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend & Backend | Next.js 16 (App Router, Server Components) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (on DO Droplet) |
| Auth | NextAuth.js (Google OAuth + Email/Password) |
| File Storage | Local disk (`/var/www/photoportugal/uploads`) |
| Process Manager | PM2 |
| Web Server | Nginx (reverse proxy) |
| CDN / DNS / SSL | Cloudflare |
| Hosting | DigitalOcean Droplet (2 vCPU, 4GB RAM, 80GB SSD) |

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

- Code pushed to GitHub → SSH into droplet → git pull → npm build → PM2 restart
- Nginx proxies port 3000, handles static caching
- Cloudflare handles SSL termination, CDN, and DNS

## Database Schema

See `docs/DATABASE.md` for full schema.

## Color Palette

- **Primary** (terracotta red): brand color, CTAs, accents
- **Accent** (forest green): verification badges, success states
- **Warm** (sandy beige): backgrounds, borders, subtle UI
- **Font Display**: Playfair Display (headings)
- **Font Sans**: Inter (body)
