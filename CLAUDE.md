# Photo Portugal — Claude project notes

Operational rules that must hold across all sessions on this codebase.

## i18n — NEVER ship raw key paths to the UI

`useTranslations("ns")` + `t("foo") || "fallback"` is a footgun. When the
namespace or key is missing from `messages/{locale}.json`, next-intl
returns the LITERAL key path (e.g. `"quickBooking.title"`), which is a
truthy string — the `|| "fallback"` is never reached, and the visitor
sees raw key paths everywhere.

**This already happened once on 2026-06-03** (QuickBookingModal shipped
with `useTranslations("quickBooking")` and no matching JSON keys — every
label rendered as `quickBooking.title` / `quickBooking.intro` / etc).
DO NOT REPEAT.

**Before committing/deploying any component that imports `useTranslations`:**

1. Add the keys to **all five** locale files (`messages/en.json`,
   `pt.json`, `de.json`, `es.json`, `fr.json`) at the same time you
   write the component. EN value can be the final copy; other locales
   may temporarily duplicate EN while translation is pending — that's
   fine, but the keys MUST exist or next-intl will leak the path.
2. The `useTranslations("ns")` namespace string must EXACTLY match a
   top-level key in messages/*.json (case-sensitive, no typos).
3. Don't rely on `t(key) || "english fallback"` as a safety net. It is
   the opposite of safe — it papers over the bug at compile time AND
   runtime.
4. After deploy, smoke-render the component in the browser. If you see
   anything like `nsname.fooBar` on screen, your ship is broken — fix
   immediately, do not ask the user to verify.
5. JSON validate each touched messages file with
   `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))"`.

If translations genuinely can wait (rare — almost never the right call
for a header / modal / critical UX surface), skip `useTranslations()`
and use plain string literals. Don't pretend you'll come back.

See: `~/.claude/projects/-Users-alex-projects-photoportugal/memory/feedback_i18n_never_ship_raw_keys.md`

## Dates & times — NEVER guess, ALWAYS run `date`

I do not have a reliable internal clock. `<system-reminder>` "Today is
X" hints arrive only intermittently, and between them I drift /
hallucinate hours and even date math. This has bitten the user
multiple times (claimed wrong day-of-week for a booking; told the user
it was 8am Phoenix when it was actually 4am — they were about to
WhatsApp a sleeping client).

**Rule:** any time a response involves today's date, current time, a
"now"-relative phrasing ("today/yesterday/tomorrow/this week"), or a
timezone conversion — run `date` via Bash FIRST, then write the
response. Do not estimate.

**Commands to use:**

```bash
# Current UTC (canonical, never DST surprises)
date -u "+%Y-%m-%d %H:%M:%S UTC"

# Local Lisbon time (the user's TZ)
TZ=Europe/Lisbon date "+%Y-%m-%d %H:%M %Z"

# Convert "now" to a client's timezone (e.g. before recommending when to message)
TZ=America/Phoenix date "+%Y-%m-%d %H:%M %Z"
TZ=America/New_York date "+%Y-%m-%d %H:%M %Z"

# Difference between two zones — just run both and read.
```

For SQL/DB queries that need a relative window ("last 30 days"), the
prod Postgres NOW() is authoritative — but for telling the user "today
is X" or "Phoenix is asleep right now", the local `date` command is
the source of truth.

If running `date` ever feels redundant for a small response, run it
anyway. The cost is one extra tool call; the cost of wrong is the user
WhatsApp-ing a client at 4am.

See: `~/.claude/projects/-Users-alex-projects-photoportugal/memory/feedback_always_run_date.md`
