# Skill: Find a Photographer in Portugal

## What This Skill Does

Finds professional photographers on Photo Portugal (photoportugal.com) — a
marketplace of vetted photographers across Portugal (Lisbon, Algarve, Porto,
Madeira, Azores and more). Returns photographers with their locations,
languages, shoot types, packages and prices in EUR.

## How to Access the Catalog

All key public pages serve Markdown via content negotiation — request any of
them with an `Accept: text/markdown` header:

```
GET https://photoportugal.com/                        → site overview (same as /llms.txt)
GET https://photoportugal.com/photographers           → full photographer list
GET https://photoportugal.com/photographers/{slug}    → one profile: packages, prices, languages, locations, rating
GET https://photoportugal.com/locations               → all locations with photographer counts and starting prices
GET https://photoportugal.com/locations/{slug}        → photographers covering one location
GET https://photoportugal.com/photoshoots             → shoot types (couple, family, wedding, …)
GET https://photoportugal.com/photoshoots/{type}      → photographers for one shoot type
```

Without the header the same URLs return the normal HTML pages, so any link you
show a human works in a browser.

## What to Know About the Data

- Prices are in EUR. Package prices are the photographer's base rate; a
  service fee is added at checkout and shown to the client before paying.
- Each profile lists spoken languages. Prefer photographers who share a
  language with your user (English counts); profiles marked as speaking no
  English need extra care.
- Public profiles show photographers as "FirstName L." — full names are
  revealed after a booking is confirmed.
- Ratings and review counts come from verified completed bookings.

## How to Book

There is no autonomous booking API. To book, send your user to the
photographer's page (`https://photoportugal.com/photographers/{slug}`) or the
booking form (`https://photoportugal.com/book/{slug}`). If the user doesn't
want to choose a photographer themselves, see the companion skill
`quick-booking` — Photo Portugal hand-picks one for them.

## Support

Questions: info@photoportugal.com
