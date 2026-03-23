# Photo Portugal — Multilingual (EN + PT) Implementation

## Status: IN PROGRESS
Started: 2026-03-20

---

## Progress Log

| Date | What | Status |
|------|------|--------|
| 2026-03-20 | Infrastructure: next-intl, middleware, routing, navigation | Done |
| 2026-03-20 | Messages: 662 EN strings extracted, 662 PT translations | Done |
| 2026-03-20 | Directory restructure: [locale]/ + (app)/ route groups | Done |
| 2026-03-20 | Layouts: root (bare) + [locale] (i18n) + (app) (EN-only) | Done |
| 2026-03-20 | Header: useTranslations + language switcher (PT/EN) | Done |
| 2026-03-20 | Footer, CookieConsent: useTranslations | Done |
| 2026-03-20 | Pages converted: Homepage, FAQ, About, Contact, Pricing, Join, For Photographers, HowItWorks, HeroSearch | Done |
| 2026-03-20 | Sitemap: dual-locale URLs with hreflang alternates | Done |
| 2026-03-20 | Deploy Phase 1+2 | Done |
| 2026-03-20 | Remaining pages: photographers, locations, blog, photoshoots, book, privacy, terms, 404, error, PackageCard | In Progress |

## Architecture

- **Library:** next-intl v4
- **Routing:** `/` = English (default, no prefix), `/pt/...` = Portuguese
- **Middleware:** src/middleware.ts — skips /dashboard, /admin, /api, /auth, /delivery
- **Messages:** messages/en.json + messages/pt.json (662 keys, 21 namespaces)
- **Localized pages:** src/app/[locale]/...
- **Non-localized:** src/app/(app)/dashboard, admin, auth, delivery

## What's Translated
- All UI strings (buttons, labels, headings, descriptions)
- Navigation, footer, cookie consent
- FAQ Q&A pairs
- Pricing plans and features
- How it works steps
- Join page tiers and descriptions

## What Stays in English
- Photographer profiles (bio, packages — user-generated)
- Blog post content (DB-stored)
- Location long descriptions (from locations-data.ts)
- Dashboard & Admin panel
- API responses
- Legal text (privacy, terms) — content only, UI chrome translated

## Files Modified
~30 page files + 5 component files + 3 config files + 2 message files
