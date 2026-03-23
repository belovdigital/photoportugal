import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

const EXCLUDED_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/uploads",
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths
  if (
    EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    /\.(svg|ico|png|jpg|jpeg|webp|gif|css|js|woff|woff2|ttf|map)$/.test(pathname) ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/og-image.png" ||
    pathname === "/logo.svg" ||
    pathname === "/hero-family.webp"
  ) {
    return;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|uploads|api).*)"],
};
