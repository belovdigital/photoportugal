import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pt", "de", "es", "fr"],
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
    },
    "/photographers/[slug]": {
      en: "/photographers/[slug]",
      pt: "/photographers/[slug]",
      de: "/fotografen/[slug]",
      es: "/fotografos/[slug]",
      fr: "/photographes/[slug]",
    },
    "/locations": {
      en: "/locations",
      pt: "/locations",
      de: "/orte",
      es: "/lugares",
      fr: "/lieux",
    },
    "/locations/[slug]": {
      en: "/locations/[slug]",
      pt: "/locations/[slug]",
      de: "/orte/[slug]",
      es: "/lugares/[slug]",
      fr: "/lieux/[slug]",
    },
    "/locations/[slug]/[occasion]": {
      en: "/locations/[slug]/[occasion]",
      pt: "/locations/[slug]/[occasion]",
      de: "/orte/[slug]/[occasion]",
      es: "/lugares/[slug]/[occasion]",
      fr: "/lieux/[slug]/[occasion]",
    },
    "/find-photographer": {
      en: "/find-photographer",
      pt: "/find-photographer",
      de: "/fotografen-finden",
      es: "/encontrar-fotografo",
      fr: "/trouver-photographe",
    },
    "/how-it-works": {
      en: "/how-it-works",
      pt: "/how-it-works",
      de: "/wie-es-funktioniert",
      es: "/como-funciona",
      fr: "/comment-ca-marche",
    },
    "/about": {
      en: "/about",
      pt: "/about",
      de: "/ueber-uns",
      es: "/sobre-nosotros",
      fr: "/a-propos",
    },
    "/faq": "/faq",
    "/photoshoots": {
      en: "/photoshoots",
      pt: "/photoshoots",
      de: "/fotoshootings",
      es: "/sesiones-de-fotos",
      fr: "/seances-photo",
    },
    "/photoshoots/[slug]": {
      en: "/photoshoots/[slug]",
      pt: "/photoshoots/[slug]",
      de: "/fotoshootings/[slug]",
      es: "/sesiones-de-fotos/[slug]",
      fr: "/seances-photo/[slug]",
    },
    "/contact": {
      en: "/contact",
      pt: "/contact",
      de: "/kontakt",
      es: "/contacto",
      fr: "/contact",
    },
    "/support": {
      en: "/support",
      pt: "/support",
      de: "/hilfe",
      es: "/ayuda",
      fr: "/aide",
    },
    "/terms": {
      en: "/terms",
      pt: "/terms",
      de: "/agb",
      es: "/terminos",
      fr: "/conditions",
    },
    "/privacy": {
      en: "/privacy",
      pt: "/privacy",
      de: "/datenschutz",
      es: "/privacidad",
      fr: "/confidentialite",
    },
  },
});
