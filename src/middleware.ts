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
    pathname === "/sitemap-images.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/llms.txt" ||
    pathname === "/llms.json" ||
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

  // Auto locale-redirect on first visit. Only for the bare site root (/), not
  // sub-pages, to avoid breaking deep-links. Respects an explicit cookie so
  // users who have switched locale aren't forced back.
  // Priority: Browser Accept-Language > CF-IPCountry geo. This avoids forcing
  // PT on English-speaking tourists physically in Portugal.
  if (pathname === "/" && !request.cookies.get("locale_pref")) {
    const accept = request.headers.get("accept-language") || "";
    const acceptLang = accept.match(/^([a-z]{2})/)?.[1];
    const cf = request.headers.get("cf-ipcountry");
    const SUPPORTED = new Set(["pt", "de", "es", "fr"]);
    let target: string | null = null;
    if (acceptLang === "en") target = null; // Stay on EN
    else if (acceptLang && SUPPORTED.has(acceptLang)) target = acceptLang;
    // Fallback only if no browser preference signal (or non-supported language) — use IP geo
    else if (!acceptLang || acceptLang.length < 2) {
      if (cf === "DE" || cf === "AT") target = "de";
      else if (cf === "PT" || cf === "BR") target = "pt";
      else if (cf === "ES" || cf === "MX" || cf === "AR" || cf === "CL" || cf === "CO" || cf === "PE") target = "es";
      else if (cf === "FR" || cf === "BE" || cf === "CH" || cf === "LU" || cf === "MC") target = "fr";
    }
    if (target) {
      const url = new URL(`/${target}`, request.url);
      const res = NextResponse.redirect(url, 302);
      res.cookies.set("locale_pref", target, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      return res;
    }
  }

  // 301 redirect: consolidate two cannibalized elopement posts into one
  if (pathname === "/blog/elopement-in-portugal-guide" || pathname === "/pt/blog/elopement-in-portugal-guide") {
    const prefix = pathname.startsWith("/pt") ? "/pt" : "";
    return NextResponse.redirect(new URL(`${prefix}/blog/how-to-elope-in-portugal`, request.url), 301);
  }

  // 301 redirects: old EN slugs under FR/ES/DE locales → localized slugs
  // (matches paths added to pathnames mapping in routing.ts)
  const SLUG_MAP: Record<string, Record<string, string>> = {
    fr: {
      "/photographers": "/photographes",
      "/locations": "/lieux",
      "/find-photographer": "/trouver-photographe",
      "/how-it-works": "/comment-ca-marche",
      "/about": "/a-propos",
      "/photoshoots": "/seances-photo",
      "/support": "/aide",
      "/terms": "/conditions",
      "/privacy": "/confidentialite",
    },
    es: {
      "/photographers": "/fotografos",
      "/locations": "/lugares",
      "/find-photographer": "/encontrar-fotografo",
      "/how-it-works": "/como-funciona",
      "/about": "/sobre-nosotros",
      "/photoshoots": "/sesiones-de-fotos",
      "/contact": "/contacto",
      "/support": "/ayuda",
      "/terms": "/terminos",
      "/privacy": "/privacidad",
    },
    de: {
      "/photographers": "/fotografen",
      "/locations": "/orte",
      "/find-photographer": "/fotografen-finden",
      "/how-it-works": "/wie-es-funktioniert",
      "/about": "/ueber-uns",
      "/photoshoots": "/fotoshootings",
      "/contact": "/kontakt",
      "/support": "/hilfe",
      "/terms": "/agb",
      "/privacy": "/datenschutz",
    },
  };
  const localeMatch = pathname.match(/^\/(fr|es|de)(\/.*)$/);
  if (localeMatch) {
    const [, loc, rest] = localeMatch;
    const map = SLUG_MAP[loc];
    if (map) {
      for (const [oldSlug, newSlug] of Object.entries(map)) {
        if (rest === oldSlug || rest.startsWith(oldSlug + "/")) {
          const replaced = rest.replace(oldSlug, newSlug);
          const url = new URL(`/${loc}${replaced}`, request.url);
          url.search = request.nextUrl.search;
          return NextResponse.redirect(url, 301);
        }
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|uploads|api).*)"],
};
