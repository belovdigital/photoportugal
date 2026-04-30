import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { getRedirect } from "./lib/redirects-cache";

const intlMiddleware = createMiddleware(routing);

// Localised slug → canonical-EN slug, per source locale.
// Used to translate a path under one locale into another locale's path.
// EN/PT share slugs (per routing.ts).
const LOCALIZED_TO_EN: Record<"de" | "es" | "fr", Record<string, string>> = {
  de: {
    "/fotografen": "/photographers",
    "/orte": "/locations",
    "/fotografen-finden": "/find-photographer",
    "/wie-es-funktioniert": "/how-it-works",
    "/ueber-uns": "/about",
    "/fotoshootings": "/photoshoots",
    "/kontakt": "/contact",
    "/hilfe": "/support",
    "/agb": "/terms",
    "/datenschutz": "/privacy",
  },
  es: {
    "/fotografos": "/photographers",
    "/lugares": "/locations",
    "/encontrar-fotografo": "/find-photographer",
    "/como-funciona": "/how-it-works",
    "/sobre-nosotros": "/about",
    "/sesiones-de-fotos": "/photoshoots",
    "/contacto": "/contact",
    "/ayuda": "/support",
    "/terminos": "/terms",
    "/privacidad": "/privacy",
  },
  fr: {
    "/photographes": "/photographers",
    "/lieux": "/locations",
    "/trouver-photographe": "/find-photographer",
    "/comment-ca-marche": "/how-it-works",
    "/a-propos": "/about",
    "/seances-photo": "/photoshoots",
    "/aide": "/support",
    "/conditions": "/terms",
    "/confidentialite": "/privacy",
  },
};
// Reverse: canonical-EN → localised
const EN_TO_LOCALIZED: Record<"de" | "es" | "fr", Record<string, string>> = {
  de: Object.fromEntries(Object.entries(LOCALIZED_TO_EN.de).map(([loc, en]) => [en, loc])),
  es: Object.fromEntries(Object.entries(LOCALIZED_TO_EN.es).map(([loc, en]) => [en, loc])),
  fr: Object.fromEntries(Object.entries(LOCALIZED_TO_EN.fr).map(([loc, en]) => [en, loc])),
};

/**
 * Translate a path under `source` locale into the equivalent path under `target` locale.
 * Returns the new full path including the target prefix (or no prefix for EN).
 *
 * Examples:
 *   remapPath("pt", "/photographers/john", "en") → "/photographers/john"
 *   remapPath("de", "/fotografen", "en") → "/photographers"
 *   remapPath("en", "/photographers", "de") → "/de/fotografen"
 *   remapPath("fr", "/photographes/john", "de") → "/de/fotografen/john"
 */
function remapPath(
  source: "en" | "pt" | "de" | "es" | "fr",
  rest: string,
  target: "en" | "pt" | "de" | "es" | "fr",
): string | null {
  // Step 1: convert source path → canonical EN path
  let canonical = rest;
  if (source === "de" || source === "es" || source === "fr") {
    const map = LOCALIZED_TO_EN[source];
    let matched = false;
    for (const [locSlug, enSlug] of Object.entries(map)) {
      if (rest === locSlug || rest.startsWith(locSlug + "/")) {
        canonical = enSlug + rest.slice(locSlug.length);
        matched = true;
        break;
      }
    }
    // Slug not in our map (e.g. /de/blog) — stays as-is, EN/PT share most non-mapped slugs.
    if (!matched) canonical = rest;
  }

  // Step 2: convert canonical EN path → target locale path
  let translated = canonical;
  if (target === "de" || target === "es" || target === "fr") {
    const map = EN_TO_LOCALIZED[target];
    for (const [enSlug, locSlug] of Object.entries(map)) {
      if (canonical === enSlug || canonical.startsWith(enSlug + "/")) {
        translated = locSlug + canonical.slice(enSlug.length);
        break;
      }
    }
  }

  // Step 3: prefix
  if (target === "en") return translated || "/";
  return `/${target}${translated}` || `/${target}`;
}

const EXCLUDED_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/uploads",
];

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const isLensPt = host === "lens.pt" || host === "www.lens.pt";

  // === Admin-managed redirects (DB-driven, in-memory cached, ~60s TTL) ===
  // Runs FIRST so a rule on `lens.pt/foo` wins over any built-in routing.
  // Query string is forwarded only when the target has none of its own —
  // lets the admin choose: target with `?utm=keep` overrides incoming query;
  // bare path `/x` carries the inbound query through.
  const rule = await getRedirect(host, pathname);
  if (rule) {
    let target = rule.target_url;
    if (request.nextUrl.search && !target.includes("?")) {
      target = target + request.nextUrl.search;
    }
    return NextResponse.redirect(target, rule.status_code as 301 | 302 | 307 | 308);
  }

  // lens.pt is a redirect-only domain — anything without an explicit rule is
  // a hard 404. We don't want any of the photoportugal.com app surface to be
  // reachable from this hostname.
  if (isLensPt) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

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

  // ===== Hero AB test: assign cookie BEFORE the page renders =====
  // Without this, server reads cookie → undefined → defaults to A, then a
  // client script writes the cookie for the *next* pageview. Result: 100% of
  // first-time visitors see A; the cookie only takes effect on refresh.
  // Computing here means the first SSR already reads a real coin flip.
  // Bots never get a cookie — they always see variant A so SEO snapshots stay stable.
  // We compute the variant up front, mutate the request cookie (so SSR sees it),
  // and bind it to whatever final response we end up returning at the bottom.
  const isHomepage =
    pathname === "/" ||
    pathname === "/pt" || pathname === "/de" || pathname === "/es" || pathname === "/fr" ||
    pathname === "/pt/" || pathname === "/de/" || pathname === "/es/" || pathname === "/fr/";
  let abAssignedVariant: "A" | "B" | null = null;
  let stripAbQuery = false;
  if (isHomepage) {
    const ua = request.headers.get("user-agent") || "";
    const isBotUA = /bot|crawl|spider|slurp|facebookexternalhit|telegrambot|whatsapp|twitterbot|linkedinbot|discordbot|preview|chatgpt|gptbot|claudebot|perplexitybot|google-pagerenderer|google-readaloud|adsbot/i.test(ua);
    const existing = request.cookies.get("ab_hero")?.value;
    const override = searchParams.get("ab");
    if (override === "A" || override === "B") {
      abAssignedVariant = override;
      stripAbQuery = true;
    } else if (override === "reset") {
      abAssignedVariant = Math.random() < 0.5 ? "A" : "B";
      stripAbQuery = true;
    } else if (!isBotUA && existing !== "A" && existing !== "B") {
      abAssignedVariant = Math.random() < 0.5 ? "A" : "B";
    }
    if (abAssignedVariant) {
      request.cookies.set("ab_hero", abAssignedVariant);
    }
  }

  function attachAbCookie(res: NextResponse): NextResponse {
    if (abAssignedVariant) {
      res.cookies.set("ab_hero", abAssignedVariant, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }
    return res;
  }

  // If only an `?ab=` override needs to be cleaned from the URL, redirect once
  // to the bare path. SSR already reads the cookie via request.cookies.
  if (stripAbQuery && abAssignedVariant) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("ab");
    return attachAbCookie(NextResponse.redirect(cleanUrl));
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

  // Bot detection — never auto-redirect crawlers (preserves SEO canonicals).
  const ua = request.headers.get("user-agent") || "";
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|telegrambot|whatsapp|twitterbot|linkedinbot|discordbot|preview|chatgpt|gptbot|claudebot|perplexitybot|google-pagerenderer|google-readaloud|adsbot/i.test(ua);

  // Picks the highest-q Accept-Language tag we support, OR null if none / EN.
  // Returns "pt" | "de" | "es" | "fr" | "en" — null means user has no preference signal.
  function preferredLocale(): "en" | "pt" | "de" | "es" | "fr" | null {
    const accept = request.headers.get("accept-language") || "";
    const SUPPORTED = new Set(["en", "pt", "de", "es", "fr"]);
    // Parse "en-US,en;q=0.9,fr;q=0.8" into ranked tags
    const parts = accept.split(",").map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.find((x) => x.trim().startsWith("q="));
      const qv = q ? parseFloat(q.split("=")[1]) : 1.0;
      return { lang: tag.toLowerCase().split("-")[0], q: isNaN(qv) ? 0 : qv };
    });
    parts.sort((a, b) => b.q - a.q);
    for (const p of parts) {
      if (SUPPORTED.has(p.lang)) return p.lang as "en" | "pt" | "de" | "es" | "fr";
    }
    // Fallback: CF geo only if no Accept-Language at all
    if (parts.length === 0 || !parts[0].lang) {
      const cf = request.headers.get("cf-ipcountry");
      if (cf === "DE" || cf === "AT") return "de";
      if (cf === "PT" || cf === "BR") return "pt";
      if (cf === "ES" || cf === "MX" || cf === "AR" || cf === "CL" || cf === "CO" || cf === "PE") return "es";
      if (cf === "FR" || cf === "BE" || cf === "CH" || cf === "LU" || cf === "MC") return "fr";
    }
    return null;
  }

  // Auto locale-redirect: honour explicit user choice (`lang_choice` cookie set by the
  // language switcher) above all else; otherwise fall back to Accept-Language. Bots
  // never get redirected so the SEO canonicals stay stable.
  //
  // Cookie semantics:
  //   - `lang_choice` = explicit manual switch via UI; if it disagrees with the URL we
  //     redirect to honour the user's choice (this also blocks browser-based redirects).
  //   - middleware never auto-sets a cookie — auto-detection runs on every request,
  //     which means a user who clears their cookie or lands from a different device
  //     gets the language their browser actually advertises.
  //   - The legacy `locale_pref` cookie is preserved but ignored (it gets cleared on
  //     the next manual switcher click); we leave it expiring naturally.
  if (!isBot) {
    const explicitChoice = request.cookies.get("lang_choice")?.value as
      | "en" | "pt" | "de" | "es" | "fr" | undefined;
    const browserPref = preferredLocale();
    // Explicit choice wins; otherwise use Accept-Language.
    const pref = explicitChoice || browserPref;

    const urlLocaleMatch = pathname.match(/^\/(pt|de|es|fr)(\/.*)?$/);
    const urlLocale = urlLocaleMatch?.[1] as "pt" | "de" | "es" | "fr" | undefined;
    const urlRest = urlLocaleMatch?.[2] || "";
    const effectiveUrlLocale: "en" | "pt" | "de" | "es" | "fr" = urlLocale || "en";

    if (pathname === "/" && pref && pref !== "en") {
      // Bare root → preferred non-EN locale
      return attachAbCookie(NextResponse.redirect(new URL(`/${pref}`, request.url), 302));
    }

    if (urlLocale && pref && pref !== urlLocale) {
      // User on a locale-prefixed URL that doesn't match their preference.
      const target = remapPath(urlLocale, urlRest, pref);
      if (target) {
        const url = new URL(target, request.url);
        url.search = request.nextUrl.search;
        return attachAbCookie(NextResponse.redirect(url, 302));
      }
    }

    // Edge case: explicit choice points away from a no-prefix EN URL — honour it.
    if (!urlLocale && explicitChoice && explicitChoice !== "en" && pathname !== "/") {
      const target = remapPath("en", pathname, explicitChoice);
      if (target && target !== pathname) {
        const url = new URL(target, request.url);
        url.search = request.nextUrl.search;
        return attachAbCookie(NextResponse.redirect(url, 302));
      }
    }
    // Suppress unused-var warning in builds
    void effectiveUrlLocale;
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

  const intlResponse = intlMiddleware(request);
  return attachAbCookie(intlResponse);
}

export const config = {
  // Excludes /api — running middleware on /api requests breaks request-body
  // streaming for multipart/form-data uploads (delivery, portfolio). lens.pt's
  // /api surface is already 404'd at the nginx layer, so we don't need
  // middleware to also block it.
  matcher: ["/((?!_next|uploads|api).*)"],
  runtime: "nodejs",
};
