import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com https://widget.intercom.io https://js.intercomcdn.com https://www.clarity.ms https://*.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' https://fonts.gstatic.com https://js.intercomcdn.com https://fonts.intercomcdn.com https://api.mapbox.com",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.google.com https://googleads.g.doubleclick.net https://api.stripe.com https://api-iam.intercom.io https://nexus-websocket-a.intercom.io https://*.clarity.ms https://c.bing.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com wss: blob:",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://intercom-sheets.com https://www.intercom-reporting.com",
  "media-src 'self' blob: https://files.photoportugal.com",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
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
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
