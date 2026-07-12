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
export function isSuspectedBotSession(s: {
  userAgent: string;
  screenWidth?: number | null;
  language?: string | null;
}): boolean {
  return /\(X11; Linux x86_64\)/.test(s.userAgent);
}
