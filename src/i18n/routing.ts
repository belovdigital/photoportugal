import { defineRouting } from "next-intl/routing";
import { locales } from "./config";

export const routing = defineRouting({
  // Active locales come from the country pack. The `pathnames` table below
  // still carries entries for every known locale — extra keys are harmless,
  // and keeping them means adding a market never means re-translating slugs.
  locales: [...locales],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false, // no cookie/header detection — only URL determines locale
  pathnames: {
    "/": "/",

    // High-SEO public pages — localized slugs per locale (PT keeps EN slugs per request)
    "/photographers": {
      en: "/photographers",
      pt: "/photographers",
      de: "/fotografen",
      es: "/fotografos",
      fr: "/photographes",
      it: "/fotografi",
    },
    "/photographers/[slug]": {
      en: "/photographers/[slug]",
      pt: "/photographers/[slug]",
      de: "/fotografen/[slug]",
      es: "/fotografos/[slug]",
      fr: "/photographes/[slug]",
      it: "/fotografi/[slug]",
    },
    // Per-package pages. Without this entry the localized form the
    // middleware slug-map 301s to (/fr/photographes/{slug}/{pkg}) has no
    // matching route and 404s — every fr/es/de package URL was a
    // 301→404 chain.
    "/photographers/[slug]/[package]": {
      en: "/photographers/[slug]/[package]",
      pt: "/photographers/[slug]/[package]",
      de: "/fotografen/[slug]/[package]",
      es: "/fotografos/[slug]/[package]",
      fr: "/photographes/[slug]/[package]",
      it: "/fotografi/[slug]/[package]",
    },
    // Filtered photographer catalog by location — keeps the literal "location"
    // segment untranslated so middleware's slug-map redirect (`/photographers`
    // → `/fotografen` only) stays consistent. Without this entry the sitemap
    // emits `/de/photographers/location/X` which then 301s to the localized
    // form, polluting Search Console with thousands of "Page with redirect".
    "/photographers/location/[slug]": {
      en: "/photographers/location/[slug]",
      pt: "/photographers/location/[slug]",
      de: "/fotografen/location/[slug]",
      es: "/fotografos/location/[slug]",
      fr: "/photographes/location/[slug]",
      it: "/fotografi/location/[slug]",
    },
    "/locations": {
      en: "/locations",
      pt: "/locations",
      de: "/orte",
      es: "/lugares",
      fr: "/lieux",
      it: "/luoghi",
    },
    "/locations/[slug]": {
      en: "/locations/[slug]",
      pt: "/locations/[slug]",
      de: "/orte/[slug]",
      es: "/lugares/[slug]",
      fr: "/lieux/[slug]",
      it: "/luoghi/[slug]",
    },
    "/locations/[slug]/[occasion]": {
      en: "/locations/[slug]/[occasion]",
      pt: "/locations/[slug]/[occasion]",
      de: "/orte/[slug]/[occasion]",
      es: "/lugares/[slug]/[occasion]",
      fr: "/lieux/[slug]/[occasion]",
      it: "/luoghi/[slug]/[occasion]",
    },
    "/how-it-works": {
      en: "/how-it-works",
      pt: "/how-it-works",
      de: "/wie-es-funktioniert",
      es: "/como-funciona",
      fr: "/comment-ca-marche",
      it: "/come-funziona",
    },
    "/about": {
      en: "/about",
      pt: "/about",
      de: "/ueber-uns",
      es: "/sobre-nosotros",
      fr: "/a-propos",
      it: "/chi-siamo",
    },
    "/faq": "/faq",
    "/photoshoots": {
      en: "/photoshoots",
      pt: "/photoshoots",
      de: "/fotoshootings",
      es: "/sesiones-de-fotos",
      fr: "/seances-photo",
      it: "/servizi-fotografici",
    },
    // Dedicated wedding landing — /photoshoots/wedding 301s here
    // (see next.config.ts redirects).
    "/weddings": {
      en: "/weddings",
      pt: "/weddings",
      de: "/hochzeiten",
      es: "/bodas",
      fr: "/mariages",
      it: "/matrimoni",
    },
    "/photoshoots/[slug]": {
      en: "/photoshoots/[slug]",
      pt: "/photoshoots/[slug]",
      de: "/fotoshootings/[slug]",
      es: "/sesiones-de-fotos/[slug]",
      fr: "/seances-photo/[slug]",
      it: "/servizi-fotografici/[slug]",
    },
    "/contact": {
      en: "/contact",
      pt: "/contact",
      de: "/kontakt",
      es: "/contacto",
      fr: "/contact",
      it: "/contatti",
    },
    "/support": {
      en: "/support",
      pt: "/support",
      de: "/hilfe",
      es: "/ayuda",
      fr: "/aide",
      it: "/assistenza",
    },
    "/terms": {
      en: "/terms",
      pt: "/terms",
      de: "/agb",
      es: "/terminos",
      fr: "/conditions",
      it: "/termini",
    },
    "/privacy": {
      en: "/privacy",
      pt: "/privacy",
      de: "/datenschutz",
      es: "/privacidad",
      fr: "/confidentialite",
      it: "/privacy",
    },
  },
});
