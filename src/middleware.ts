import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

const EXCLUDED_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/uploads",
];

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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

  // 301 redirect: /blog?page=N → /blog/page/N
  const blogMatch = pathname.match(/^(\/pt)?\/blog\/?$/);
  if (blogMatch && searchParams.get("page")) {
    const page = searchParams.get("page");
    if (page && parseInt(page) > 1) {
      const prefix = blogMatch[1] || "";
      return NextResponse.redirect(new URL(`${prefix}/blog/page/${page}`, request.url), 301);
    }
  }

  // Redirect /pt/blog/page/N → /blog/page/N (PT has very few posts, pagination doesn't exist)
  const ptBlogPageMatch = pathname.match(/^\/pt\/blog\/page\/(\d+)$/);
  if (ptBlogPageMatch) {
    return NextResponse.redirect(new URL(`/blog/page/${ptBlogPageMatch[1]}`, request.url), 301);
  }

  // Redirect /book and /pt/book (no slug) → /photographers
  if (pathname === "/book" || pathname === "/pt/book") {
    return NextResponse.redirect(new URL("/photographers", request.url), 301);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|uploads|api).*)"],
};
