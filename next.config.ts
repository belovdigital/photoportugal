import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com https://widget.intercom.io https://js.intercomcdn.com https://www.clarity.ms https://*.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' https://fonts.gstatic.com https://js.intercomcdn.com https://fonts.intercomcdn.com https://api.mapbox.com",
  "connect-src 'self' https://meet.photoportugal.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.google.com https://googleads.g.doubleclick.net https://api.stripe.com https://api-iam.intercom.io https://nexus-websocket-a.intercom.io https://*.clarity.ms https://c.bing.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com wss: blob:",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://intercom-sheets.com https://www.intercom-reporting.com",
  "media-src 'self' blob: https://files.photoportugal.com",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Strip console.log / .info / .debug from production bundles. Keeps
  // .error and .warn so real failures still surface in the user's
  // DevTools (useful when triaging issue reports). The removeConsole
  // option only runs for production builds; `next dev` keeps everything.
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Curated CC-licensed photos for /spots/[city]/[spot] hero +
        // gallery come from Wikimedia Commons. Required so next/image can
        // serve them through our optimisation pipeline.
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  // 301s for the deleted /lp/* ad-LP templates. Google Ads + warmup links
  // historically pointed here; we redirect to the canonical location page in
  // each locale so any lingering inbound link / cached URL still lands somewhere
  // useful instead of a 404.
  async redirects() {
    return [
      { source: "/lp", destination: "/", permanent: true },
      { source: "/lp/:city", destination: "/locations/:city", permanent: true },
      { source: "/pt/lp", destination: "/pt", permanent: true },
      { source: "/pt/lp/:city", destination: "/pt/locations/:city", permanent: true },
      { source: "/de/lp", destination: "/de", permanent: true },
      { source: "/de/lp/:city", destination: "/de/orte/:city", permanent: true },
      { source: "/es/lp", destination: "/es", permanent: true },
      { source: "/es/lp/:city", destination: "/es/lugares/:city", permanent: true },
      { source: "/fr/lp", destination: "/fr", permanent: true },
      { source: "/fr/lp/:city", destination: "/fr/lieux/:city", permanent: true },
      // Legacy aliases that the codebase already redirects via Next's
      // redirect() runtime helper (which returns 307). Repeating them
      // here gives Google a 308 instead, which consolidates link equity
      // faster.
      { source: "/join", destination: "/for-photographers/join", permanent: true },
      { source: "/help-center", destination: "/support", permanent: true },
      { source: "/how-we-select", destination: "/for-photographers/how-we-select", permanent: true },
      { source: "/pt/join", destination: "/pt/for-photographers/join", permanent: true },
      { source: "/pt/help-center", destination: "/pt/support", permanent: true },
      { source: "/pt/how-we-select", destination: "/pt/for-photographers/how-we-select", permanent: true },
      { source: "/de/join", destination: "/de/for-photographers/join", permanent: true },
      { source: "/de/help-center", destination: "/de/support", permanent: true },
      { source: "/de/how-we-select", destination: "/de/for-photographers/how-we-select", permanent: true },
      { source: "/es/join", destination: "/es/for-photographers/join", permanent: true },
      { source: "/es/help-center", destination: "/es/support", permanent: true },
      { source: "/es/how-we-select", destination: "/es/for-photographers/how-we-select", permanent: true },
      { source: "/fr/join", destination: "/fr/for-photographers/join", permanent: true },
      { source: "/fr/help-center", destination: "/fr/support", permanent: true },
      { source: "/fr/how-we-select", destination: "/fr/for-photographers/how-we-select", permanent: true },
      // Retired pages — manual matching flow killed in favour of AI
      // Concierge. Any inbound link (Google cache, old blog post, ad
      // copy) lands at /concierge instead. EN paths + every localized
      // alias we historically served.
      { source: "/find-photographer", destination: "/concierge", permanent: true },
      { source: "/choose-booking-type", destination: "/concierge", permanent: true },
      { source: "/pt/find-photographer", destination: "/pt/concierge", permanent: true },
      { source: "/pt/choose-booking-type", destination: "/pt/concierge", permanent: true },
      { source: "/de/fotografen-finden", destination: "/de/concierge", permanent: true },
      { source: "/de/choose-booking-type", destination: "/de/concierge", permanent: true },
      { source: "/es/encontrar-fotografo", destination: "/es/concierge", permanent: true },
      { source: "/es/choose-booking-type", destination: "/es/concierge", permanent: true },
      { source: "/fr/trouver-photographe", destination: "/fr/concierge", permanent: true },
      { source: "/fr/choose-booking-type", destination: "/fr/concierge", permanent: true },
      // Wedding got its own landing — /photoshoots/wedding (and localized
      // aliases) consolidate into /weddings so the two pages don't compete
      // for the same "wedding photographer portugal" queries.
      { source: "/photoshoots/wedding", destination: "/weddings", permanent: true },
      { source: "/pt/photoshoots/wedding", destination: "/pt/weddings", permanent: true },
      { source: "/de/fotoshootings/wedding", destination: "/de/hochzeiten", permanent: true },
      { source: "/es/sesiones-de-fotos/wedding", destination: "/es/bodas", permanent: true },
      { source: "/fr/seances-photo/wedding", destination: "/fr/mariages", permanent: true },
      // Business shoot type consolidates into the /for-business landing —
      // the generic shoot-type template (consumer hero, summer offer,
      // couple packages) is wrong for a B2B audience.
      { source: "/photoshoots/business", destination: "/for-business", permanent: true },
      { source: "/pt/photoshoots/business", destination: "/pt/for-business", permanent: true },
      { source: "/de/fotoshootings/business", destination: "/de/for-business", permanent: true },
      { source: "/es/sesiones-de-fotos/business", destination: "/es/for-business", permanent: true },
      { source: "/fr/seances-photo/business", destination: "/fr/for-business", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            // Allow camera + microphone for video reviews, payment for Stripe,
            // fullscreen for lightboxes; block everything else.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), payment=*, fullscreen=(self), autoplay=(self), encrypted-media=(self), picture-in-picture=(self), geolocation=(), usb=(), serial=(), bluetooth=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=(), ambient-light-sensor=()",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/img/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
