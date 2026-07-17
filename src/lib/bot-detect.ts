// Bot detection for visitor tracking.
//
// Two tiers:
//  - isBotUserAgent(): the UA self-identifies as a bot / crawler /
//    preview-fetcher / HTTP tool. These sessions are not recorded at
//    all (track-session returns early, same as the old inline check
//    but with a far broader list — AI agents, link previews, SEO
//    tools, monitoring probes).
//  - isSuspectedBotSession(): stealth scrapers with spoofed browser
//    UAs, detected by fleet signature rather than name. These ARE
//    recorded but flagged is_bot=TRUE so admin analytics can exclude
//    them without losing the raw data. Read queries exempt sessions
//    that later link to a signed-in user (is_bot AND user_id IS NULL),
//    so a rare real visitor matching the signature stays visible the
//    moment they log in.
//
// Fleet evidence (2026-07-12, prod, trailing 7d): 2 071 sessions with
// UA "(X11; Linux x86_64) … Chrome/149", 2 067 distinct visitor_ids
// (fresh identity per visit — defeats per-visitor rate limits), avg
// exactly 1.0 pageviews, 93% screen_width=1919, 100% en-US, GeoIP
// almost entirely US/SG datacenters. Genuine bare-X11 Linux desktop
// visitors on a Portugal-tourism site are a rounding error; signed-in
// ones remain visible via the user_id exemption.

// (?<!cu)bot\b — "bot" as a word, but not CUBOT phones (real budget
// Androids whose model name would otherwise match).
const BOT_UA =
  /(?<!cu)bot\b|bot[\/;)-]|crawler|spider|scrape|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|site24x7|checkly|datadog|prerender|python-requests|python\/|aiohttp|httpx\/|curl\/|wget\/|go-http-client|okhttp|java\/|node-fetch|axios\/|libwww|urllib|scrapy|feedfetcher|facebookexternalhit|meta-externalagent|whatsapp|skypeuripreview|vkshare|applebot|amazonbot|bytespider|petalbot|yandex|baidu|duckduck|sogou|seznam|qwantify|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|claude-user|anthropic-ai|perplexitybot|perplexity-user|youbot|cohere-ai|ccbot|diffbot|omgili|timpibot|imagesiftbot|dataforseo|serpstat|megaindex|zoominfobot|barkrowler|netcraft|expanse|censys|shodan|zgrab|nuclei|masscan|playstore-google|google-inspectiontool|googleother|google-extended|storebot|adsbot|mediapartners|apis-google|bingpreview|electron\//i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true; // no real browser sends a tiny/empty UA
  return BOT_UA.test(ua);
}

// Stealth-fleet signature. Deliberately matches the whole UA family,
// not one Chrome version — the fleet rotates versions (148/149/150 seen).
// "(X11; Linux x86_64)" is the bare-headless token; real desktop-Linux
// browsers overwhelmingly carry a distro or Wayland marker (e.g.
// "X11; Ubuntu; Linux x86_64") which does NOT match.
// Desktop Chrome auto-updates within days of a release; anything many
// majors behind on a DESKTOP UA is a scripted/headless client, not a real
// browser. Real traffic here (2026-07, referrer'd or logged-in) is Chrome
// 137-150 — 99% on 148-150. The 2nd stealth fleet (Singapore datacenter,
// switched from the X11 UA to "Windows NT 10.0" after the Cloudflare
// challenge) rotates through Chrome 103-133, all screen_width=1280, no
// referrer, 1 pageview. In 3 days of prod data every session ≤ this floor
// was that fleet; zero real users. Bump this floor as Chrome advances —
// keep a wide margin below the real-traffic band so a neglected corporate
// desktop is never caught (and if one is, the read-side "is_bot AND
// user_id IS NULL" exemption un-hides it the moment they log in).
const MIN_REAL_DESKTOP_CHROME = 135;

export function isSuspectedBotSession(s: {
  userAgent: string;
  screenWidth?: number | null;
  language?: string | null;
}): boolean {
  const ua = s.userAgent || "";
  // Fleet #1 — bare headless Linux desktop.
  if (/\(X11; Linux x86_64\)/.test(ua)) return true;

  // Fleet #2 — desktop (Windows/Mac, non-mobile) Chrome stuck on an old
  // major. Mobile is excluded: old Android webviews legitimately report
  // ancient Chromium majors, so this only applies to desktop platform
  // tokens. Chrome major is the `Chrome/NNN` token (Edge/Opera reuse it
  // but also auto-update, so the same floor holds).
  const isDesktop = /Windows NT|Macintosh|X11/.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua);
  if (isDesktop) {
    const m = ua.match(/Chrome\/(\d+)/);
    if (m && Number(m[1]) < MIN_REAL_DESKTOP_CHROME) return true;
  }
  return false;
}
