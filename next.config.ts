import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
