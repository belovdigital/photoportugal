-- Bot flag for visitor_sessions (2026-07-12).
--
-- Self-identified crawlers are skipped at ingest (see src/lib/bot-detect.ts),
-- but stealth scrapers spoof plain browser UAs. Those are recorded with
-- is_bot = TRUE and excluded from admin analytics at read time via
--   NOT (COALESCE(is_bot, FALSE) AND user_id IS NULL)
-- — the user_id exemption keeps a session visible if it ever links to a
-- real signed-in user.
--
-- Fleet that triggered this (prod, trailing 7d of 2026-07-12): 2 071
-- sessions from UA "(X11; Linux x86_64) … Chrome/149", 2 067 distinct
-- visitor_ids, avg exactly 1.0 pageviews, 93% screen_width=1919,
-- 100% en-US, GeoIP mostly US/SG datacenters.

ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill history. Two families:
--  1) the stealth fleet signature (bare X11 Linux desktop Chrome);
--  2) self-identified bots/tools recorded before the ingest blocklist
--     covered them (HeadlessChrome, AI agents, link-preview fetchers,
--     HTTP libraries, store/monitoring probes, empty UAs).
-- CUBOT phones are real budget Androids whose model name contains "bot" —
-- explicitly exempt.
UPDATE visitor_sessions SET is_bot = TRUE
WHERE COALESCE(is_bot, FALSE) = FALSE
  AND user_id IS NULL
  AND (
    user_agent IS NULL
    OR LENGTH(user_agent) < 20
    OR user_agent LIKE '%(X11; Linux x86_64)%'
    OR (
      user_agent ~* '(bot[-/;) ]|bot$|crawler|spider|scrape|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|prerender|python|aiohttp|httpx|curl/|wget/|go-http-client|okhttp|java/|node-fetch|axios/|scrapy|facebookexternalhit|meta-externalagent|whatsapp|skypeuripreview|applebot|amazonbot|bytespider|petalbot|yandex|baidu|duckduck|seznam|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|claude-user|anthropic|perplexity|cohere-ai|ccbot|diffbot|dataforseo|playstore-google|google-inspectiontool|googleother|google-extended|storebot|bingpreview|electron/)'
      AND user_agent NOT ILIKE '%cubot%'
    )
  );
