import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { country, byCountry } from "@/lib/country";
import { getTranslations } from "next-intl/server";
import { showsInvoicingAnnouncement } from "@/lib/invoicing-announcement";

export const dynamic = "force-dynamic";

// First-week playbook for newly-approved photographers. Live mockups
// (inline JSX, no PNG dependencies) mirror real product UI so they don't
// rot when we ship UI changes. Photographer-only — clients land elsewhere.

export default async function GettingStartedPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string; name: string }>(
    "SELECT role, name FROM users WHERE id = $1",
    [userId]
  );
  if (user?.role !== "photographer") redirect("/dashboard");

  // Mark the guide as seen so we don't auto-redirect the photographer
  // here again on subsequent dashboard loads. Fire-and-forget — guarded
  // by the IS NULL condition so revisits stay cheap (no-op UPDATE).
  query(
    "UPDATE photographer_profiles SET getting_started_seen_at = NOW() WHERE user_id = $1 AND getting_started_seen_at IS NULL",
    [userId]
  ).catch(() => {});

  const firstName = (user.name || "").split(" ")[0] || "there";
  const t = await getTranslations("gettingStarted");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero */}
      <header className="mb-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {t("welcome", { brand: country.brand, name: firstName })}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-gray-600">
          {t("intro")}
        </p>
      </header>

      {/* Not a tip — an obligation, so it sits above the numbered playbook
          rather than inside it, and does not take a step number. Market-gated
          like every other invoicing surface (LIVE_BY_MARKET). */}
      {showsInvoicingAnnouncement && (
        <section className="mb-12 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <svg className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-amber-900">
                {t("invoicingTitle")}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-amber-900">
                {t("invoicingBody")}
              </p>
              <Link
                href="/dashboard/invoicing"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                {t("invoicingCta")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-12">
        <Section
          n={1}
          icon="⚡"
          title={t("s1title")}
          body={t("s1body")}
          cta={{ href: "/dashboard/messages", label: "Open messages →" }}
          mockup={<FastReplyMockup />}
          extra={<ToneTipBlock />}
        />

        <Section
          n={2}
          icon="📅"
          title={t("s2title")}
          body={t("s2body")}
          cta={{ href: "/dashboard/calendar-sync", label: "Connect calendar →" }}
          mockup={<CalendarSyncMockup />}
        />

        <Section
          n={3}
          icon="📦"
          title={t("s3title")}
          body={t("s3body", { brand: country.brand })}
          mockup={<SendPackageMockup />}
        />

        <Section
          n={4}
          icon="✨"
          title={t("s4title")}
          body={t("s4body")}
          mockup={<AiChipsMockup />}
        />

        <Section
          n={5}
          icon="🚫"
          title={t("s5title")}
          body={t("s5body")}
          mockup={<OffPlatformMockup />}
        />

        <Section
          n={6}
          icon="⭐"
          title={t("s6title")}
          body={t("s6body")}
          mockup={<ReviewMockup />}
          extra={<ReviewTemplateBlock />}
        />

        <Section
          n={7}
          icon="✓"
          title={t("s7title")}
          body={t("s7body")}
          cta={{ href: "/dashboard/subscriptions", label: "See add-ons →" }}
          mockup={<BadgesMockup />}
        />

        {/* Only where the apps are actually published. Spain has no listing, so
            this step told photographers to install something that doesn't exist
            and showed a mockup branded Photo Portugal. */}
        {country.hasMobileApp && (
        <Section
          n={8}
          icon="📱"
          title={t("s8title")}
          body={t("s8body", { brand: country.brand })}
          mockup={<MobileAppMockup />}
        />
        )}

        {/* Numbered after the app step, which Spain does not show — so the list
            never skips a number in either market. */}
        <Section
          n={country.hasMobileApp ? 9 : 8}
          icon="🖼️"
          title={t("s9title")}
          body={t("s9body")}
          mockup={<ExtraPhotosMockup />}
        />
      </div>

      <div className="mt-16 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-warm-50 p-8 text-center">
        <p className="font-display text-2xl font-bold text-gray-900">
          We're really glad you're here 🤍
        </p>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-gray-700">
          {country.brand} is a small team that cares about the photographers on it —
          you're not a row in a spreadsheet. We hope you have a great experience, and
          we're always open to your questions, ideas, and the things you wish worked
          differently. Tell us anything.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          — Kate &amp; the {country.brand} team
        </p>
      </div>

      <footer className="mt-6 rounded-2xl border border-warm-200 bg-warm-50 p-6 text-center sm:p-8">
        <p className="text-base font-semibold text-gray-900">Got questions?</p>
        <p className="mt-1 text-sm text-gray-600">
          Reply to any email from us, message us in support, or just DM Kate directly —
          we're real humans on the other end.
        </p>
        <Link
          href="/dashboard/support"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Open support
        </Link>
      </footer>
    </div>
  );
}

function Section({
  n,
  icon,
  title,
  body,
  cta,
  mockup,
  extra,
}: {
  n: number;
  icon: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  mockup: React.ReactNode;
  /** Optional second block below the mockup — used for tone tips,
   *  copy-paste templates, etc. that don't belong inside the body. */
  extra?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-2xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Step {n}
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-gray-900 sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-gray-600">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          {cta.label}
        </Link>
      )}
      <div className="mt-6">{mockup}</div>
      {extra && <div className="mt-4">{extra}</div>}
    </section>
  );
}

// ─── Mockups ────────────────────────────────────────────────────────────

function FastReplyMockup() {
  return (
    <div className="rounded-xl border border-warm-200 bg-warm-50/50 p-4 space-y-2">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-pink-200 to-amber-200" />
        <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-white border border-warm-200 px-3 py-2 text-sm text-gray-800">
          Hi! Are you free for a couples shoot Aug 15 in {byCountry({ pt: "Comporta", es: "Sitges", it: "Positano" })}?
          <div className="mt-1 text-[10px] text-gray-400">just now</div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-primary-600 px-3 py-2 text-sm text-white">
          Yes! Sunset session would be perfect there. Sending you my package now ✨
          <div className="mt-1 text-right text-[10px] text-white/70">3 min later · ⚡ fast reply</div>
        </div>
      </div>
      <div className="pt-2 text-center text-[11px] text-gray-500">
        Median first-reply on {country.brand}: <span className="font-bold text-emerald-600">42 minutes</span>
      </div>
    </div>
  );
}

function CalendarSyncMockup() {
  const days = [
    { d: 12, status: "free" }, { d: 13, status: "busy" }, { d: 14, status: "free" },
    { d: 15, status: "free" }, { d: 16, status: "busy" }, { d: 17, status: "free" },
    { d: 18, status: "free" },
  ];
  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">August 2026</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synced
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <div
            key={d.d}
            className={`h-12 rounded-lg flex flex-col items-center justify-center text-xs ${
              d.status === "busy"
                ? "bg-warm-100 text-gray-400 line-through"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            <span className="font-semibold">{d.d}</span>
            <span className="text-[9px] uppercase">{d.status === "busy" ? "busy" : "open"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SendPackageMockup() {
  return (
    <div className="rounded-xl border border-warm-200 bg-warm-50/50 p-4">
      <div className="flex justify-end mb-2">
        <div className="rounded-2xl rounded-br-sm bg-primary-600 px-3 py-2 text-sm text-white max-w-[70%]">
          Here's the Couples Express — happy to start there 👇
        </div>
      </div>
      <div className="mx-auto max-w-[280px] rounded-2xl border border-primary-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center text-2xl">📦</div>
        <p className="mt-2 text-center text-sm font-bold text-gray-900">Couples Express</p>
        <p className="mt-1 text-center text-[11px] text-gray-500">60 min · 40 photos</p>
        <p className="mt-2 text-center text-2xl font-bold text-primary-600">€300</p>
        <button className="mt-3 w-full rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white">
          Book now
        </button>
      </div>
    </div>
  );
}

function ToneTipBlock() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
        How you reply matters as much as how fast
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-amber-900/90">
        The first message sets the tone for trust — in you AND the platform. Don't open
        with &ldquo;Hi. €450 for 1h.&rdquo; Instead:
      </p>
      <ol className="mt-2 ml-4 list-decimal space-y-1 text-[13px] leading-relaxed text-amber-900/90">
        <li><strong>Greet</strong> by name.</li>
        <li><strong>Congratulate</strong> the occasion if there is one (engagement 🎉, honeymoon 💛, family vacation, milestone birthday).</li>
        <li><strong>Compliment</strong> their location choice ({byCountry({
            pt: "Comporta dunes at sunset, Sintra palaces in the mist",
            es: "Ronda's gorge at golden hour, the Albaicín lanes in the morning",
            it: "the Amalfi terraces at golden hour, Val d'Orcia in the morning mist",
          })}).</li>
        <li><strong>Pitch</strong> the package.</li>
        <li><strong>End with a question</strong> — &ldquo;how many of you will be there?&rdquo;, &ldquo;any specific vibe in mind?&rdquo;, &ldquo;morning or sunset?&rdquo;. Giving them something to reply to is the difference between a conversation and a quote that goes cold.</li>
      </ol>
      <p className="mt-3 text-[12px] italic leading-relaxed text-amber-900/80">
        Cold price quotes feel transactional. Warmth + a hook converts.
      </p>
    </div>
  );
}

function ReviewTemplateBlock() {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-yellow-700">
        Copy-paste template
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-yellow-900/90 italic">
        &ldquo;Hey [name]! So glad you loved them 🤍 If you have a sec, would mean the
        world if you left a quick review on the gallery page — even one line helps me
        a lot. Thank you for trusting me with this!&rdquo;
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-yellow-900/70">
        Swap the name, tweak the wording to your voice. Send it ~1 day after delivery,
        before Kate's automatic request goes out — clients respond more to a personal
        nudge from you than a system email.
      </p>
    </div>
  );
}

function AiChipsMockup() {
  return (
    <div className="rounded-xl border border-warm-200 bg-gradient-to-b from-purple-50/40 to-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
          ✨ AI suggestions
        </span>
        <span className="text-[10px] text-gray-400 underline">None fit</span>
      </div>
      <div className="space-y-1.5">
        {[
          "Yes I'm free Aug 15! Sunset light around 8pm there is unreal — happy to recommend a spot.",
          "Aug 15 is taken, but how about the 16th? Same vibe, my schedule's open.",
          "Could you share roughly how many people and what feeling you're going for?",
        ].map((t, i) => (
          <div key={i} className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-[13px] text-gray-700">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function OffPlatformMockup() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-red-100 border border-red-200 px-3 py-2 text-sm text-red-900 line-through opacity-70">
          Sure! WhatsApp me at {country.dialCode} 91...
        </div>
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <span className="font-bold">🚨 Auto-flagged.</span> Admin alerted. Stripe protection
        would be voided if you went off-platform.
      </div>
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary-600 px-3 py-2 text-sm text-white">
          Easiest is right here in chat — let's pick a date and I'll send the package ✨
        </div>
      </div>
    </div>
  );
}

function ReviewMockup() {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center text-white font-bold text-sm">
          K
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">Kate Belova</p>
          <p className="text-[11px] text-gray-500">Founder of {country.brand}</p>
          <p className="mt-2 text-[13px] text-gray-700 leading-relaxed">
            Hope you loved your shoot! A quick review means the world to us — and as a
            thank-you, here's <span className="font-semibold text-yellow-700">10% off</span> your next session.
          </p>
          <button className="mt-3 inline-flex items-center gap-1 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-900">
            ⭐ Leave a review
          </button>
        </div>
      </div>
    </div>
  );
}

// A shrunk-down copy of the two groups on the delivery screen, so the tip and
// the screen it describes look like the same thing.
function ExtraPhotosMockup() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold text-gray-900">&#10003; In the delivery &middot; 20 photos</p>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-square rounded bg-gradient-to-br from-warm-200 to-warm-300" />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-amber-800">&euro; Extra photos &middot; 15</p>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="relative aspect-square rounded bg-gradient-to-br from-amber-100 to-amber-200" />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-500">You keep your own price on every one sold</p>
      </div>
    </div>
  );
}

function BadgesMockup() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">✓</span>
          <span className="text-sm font-bold text-gray-900">Maria S.</span>
          <span className="text-blue-500 text-xs font-semibold">Verified</span>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">€19 / year · Phone-verified</p>
        <p className="text-[11px] font-semibold text-blue-700">+2-3× trust</p>
      </div>
      <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-base">⭐</span>
          <span className="text-sm font-bold text-gray-900">Featured</span>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">€19 / month · Top of search</p>
        <p className="text-[11px] font-semibold text-amber-700">+~30% more inquiries</p>
      </div>
    </div>
  );
}

function MobileAppMockup() {
  return (
    <div className="rounded-xl border border-warm-200 bg-warm-50/40 p-4">
      <div className="mx-auto w-fit rounded-3xl border-4 border-gray-900 bg-white px-3 py-3 shadow-lg" style={{ width: 180 }}>
        <div className="mb-2 flex items-center justify-between text-[9px] text-gray-500">
          <span>9:41</span>
          <span>•••</span>
        </div>
        <div className="rounded-xl bg-gray-100 p-2 text-[10px] space-y-1">
          <p className="font-bold text-gray-900">{country.brand.toUpperCase()}</p>
          <p className="font-bold text-gray-900">💬 Maria</p>
          <p className="text-gray-600">Hi! Are you free Aug 15?</p>
        </div>
        <p className="mt-2 text-center text-[9px] text-gray-400">2 sec ago</p>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-500">
        Push notifications reach you in seconds, not minutes
      </p>
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <a
          href="https://apps.apple.com/app/id6761375811"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-white hover:bg-black transition w-full sm:w-auto justify-center"
        >
          <svg className="h-6 w-6" viewBox="0 0 384 512" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
          </svg>
          <span className="text-left">
            <span className="block text-[10px] uppercase tracking-wide text-white/70">Download on the</span>
            <span className="block text-sm font-bold leading-tight">App Store</span>
          </span>
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=com.photoportugal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-white hover:bg-black transition w-full sm:w-auto justify-center"
        >
          <svg className="h-6 w-6" viewBox="0 0 512 512" fill="currentColor">
            <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
          </svg>
          <span className="text-left">
            <span className="block text-[10px] uppercase tracking-wide text-white/70">Get it on</span>
            <span className="block text-sm font-bold leading-tight">Google Play</span>
          </span>
        </a>
      </div>
    </div>
  );
}
