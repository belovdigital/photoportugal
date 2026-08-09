import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { RequestApprovalButton } from "@/components/dashboard/RequestApprovalButton";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { isPayoutReady } from "@/lib/payout";
import { onboardingStage, daysUntilStripeDeadline } from "@/lib/onboarding-stage";
import { country, byCountry } from "@/lib/country";
import { RevisionChecklist } from "@/components/dashboard/RevisionChecklist";
import { ActionNeededWidget } from "@/components/dashboard/ActionNeededWidget";
import { PhotographerCalendarWidget } from "@/components/dashboard/PhotographerCalendarWidget";
import { AddOnsSection } from "@/app/[locale]/dashboard/subscriptions/AddOnsSection";
import { getPhotographerTasks } from "@/lib/photographer-tasks";
import { syncStripeOnboardingIfStale } from "@/lib/stripe-sync";
import { getLocale } from "next-intl/server";
import { MIN_PORTFOLIO_PHOTOS } from "@/lib/portfolio-requirements";


// Popular-destination chips, per market. These are links to /locations/<slug>,
// so a Portuguese list on the Spanish dashboard sent photographers to 404s.
const POPULAR_CITIES = byCountry({
  pt: [
    { slug: "lisbon", name: "Lisbon" },
    { slug: "porto", name: "Porto" },
    { slug: "algarve", name: "Algarve" },
    { slug: "sintra", name: "Sintra" },
    { slug: "madeira", name: "Madeira" },
    { slug: "azores", name: "Azores" },
  ],
  es: [
    { slug: "barcelona", name: "Barcelona" },
    { slug: "madrid", name: "Madrid" },
    { slug: "seville", name: "Seville" },
    { slug: "granada", name: "Granada" },
    { slug: "mallorca", name: "Mallorca" },
    { slug: "tenerife", name: "Tenerife" },
  ],
  it: [
    { slug: "rome", name: "Rome" },
    { slug: "florence", name: "Florence" },
    { slug: "venice", name: "Venice" },
    { slug: "milan", name: "Milan" },
    { slug: "amalfi-coast", name: "Amalfi Coast" },
    { slug: "lake-como", name: "Lake Como" },
  ],
});

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string; name: string }>(
    "SELECT role, name FROM users WHERE id = $1",
    [userId]
  );

  const role = user?.role || "client";
  const name = user?.name || session.user.name || "there";

  // Clients go straight to bookings
  if (role === "client") {
    redirect("/dashboard/bookings");
  }

  return <PhotographerOverview userId={userId!} name={name} />;
}

async function ClientOverview({ userId, name }: { userId: string; name: string }) {
  const t = await getTranslations("dashboard");
  const [bookingCount, clientUser] = await Promise.all([
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM bookings WHERE client_id = $1",
      [userId]
    ),
    queryOne<{ avatar_url: string | null }>(
      "SELECT avatar_url FROM users WHERE id = $1",
      [userId]
    ),
  ]);

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("welcomeBack", { name })}</h1>
      <p className="mt-1 text-gray-500">{t("findPhotographer")}</p>

      <div className="mt-6 mb-8">
        <OnboardingChecklist
          role="client"
          userId={userId}
          checks={{
            avatar: !!clientUser?.avatar_url,
            cover: false,
            bio: false,
            portfolio: 0,
            packages: 0,
            locations: 0,
            stripeConnected: false,
            bookings: parseInt(bookingCount?.count || "0", 10),
          }}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard
          href="/photographers"
          title={t("findPhotographers")}
          description={t("browsePortfolios")}
          icon="search"
          accent
        />
        <OverviewCard
          href="/dashboard/bookings"
          title={t("myBookings")}
          description={bookingCount?.count === "1" ? t("bookingCount", { count: bookingCount?.count || 0 }) : t("bookingCountPlural", { count: bookingCount?.count || 0 })}
          icon="calendar"
        />
        <OverviewCard
          href="/dashboard/messages"
          title={t("messages")}
          description={t("chatWithPhotographers")}
          icon="chat"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">{t("popularDestinations")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {POPULAR_CITIES.map((city) => (
            <Link
              key={city.slug}
              href={`/locations/${city.slug}`}
              className="rounded-full border border-warm-200 px-4 py-2 text-sm text-gray-600 transition hover:border-primary-300 hover:text-primary-600"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/support" className="text-sm text-gray-400 hover:text-primary-600">
          {t("needHelp")} {t("helpCenterLink")} &rarr;
        </Link>
      </div>
    </div>
  );
}

async function PhotographerOverview({ userId, name }: { userId: string; name: string }) {
  const t = await getTranslations("dashboard");
  const profile = await queryOne<{
    id: string; rating: number; review_count: number; session_count: number; plan: string; slug: string; is_approved: boolean;
    avatar_url: string | null; cover_url: string | null; bio: string | null;
    stripe_account_id: string | null; stripe_onboarding_complete: boolean;
    phone: string | null; created_at: string; revision_status: string | null;
    approval_requested_at: string | null; stripe_deadline_at: string | null; stripe_hidden_at: string | null;
    is_verified: boolean; is_featured: boolean; phone_verified: boolean; phone_number: string | null;
    getting_started_seen_at: string | null;
  }>(
    `SELECT pp.id, pp.rating, pp.review_count, pp.session_count, pp.plan, pp.slug, pp.is_approved,
            u.avatar_url, pp.cover_url, pp.bio, pp.stripe_account_id, pp.stripe_onboarding_complete,
            u.phone, pp.created_at, pp.revision_status,
            pp.approval_requested_at, pp.stripe_deadline_at, pp.stripe_hidden_at,
            pp.is_verified, pp.is_featured, pp.phone_verified, pp.phone_number,
            pp.getting_started_seen_at
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.user_id = $1`,
    [userId]
  );

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">{t("noProfileFound")}</p>
      </div>
    );
  }

  // First dashboard load after approval — push the photographer through
  // the getting-started guide. The guide marks itself as seen on render,
  // so this redirect only fires once per photographer ever.
  if (profile.is_approved && !profile.getting_started_seen_at) {
    redirect("/dashboard/getting-started");
  }

  // Self-heal stale stripe_onboarding_complete by live-checking Stripe when the
  // flag is false but an account exists. Webhooks get missed occasionally.
  profile.stripe_onboarding_complete = await syncStripeOnboardingIfStale(
    profile.stripe_account_id,
    profile.stripe_onboarding_complete
  );

  const locale = await getLocale();
  const tasks = await getPhotographerTasks(profile.id, userId);

  // A calendar that stopped syncing is invisible otherwise: the connection
  // still shows as connected, and the cached busy slots quietly go stale while
  // the booking check keeps reading them. One sat broken for 2.5 months.
  const brokenCalendar = await queryOne<{ display_name: string; type: string; days: number }>(
    `SELECT display_name, type,
            GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - sync_error_since)) / 86400))::int AS days
       FROM calendar_connections
      WHERE photographer_id = $1 AND is_active AND last_sync_error IS NOT NULL
      ORDER BY sync_error_since NULLS LAST LIMIT 1`,
    [profile.id]
  );

  const [pendingBookings, totalBookings, portfolioCount, packageCount, locationCount] = await Promise.all([
    queryOne<{ count: string }>(
      // Pending = awaiting photographer action. 'inquiry' is admin-only (pre-booking chat) and must not show up here.
      "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1 AND status = 'pending'",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      // Total = confirmed bookings only (payment received, not cancelled, not the admin-only inquiry pseudo-status).
      "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1 AND payment_status = 'paid' AND status NOT IN ('inquiry', 'cancelled')",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM portfolio_items WHERE photographer_id = $1",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM packages WHERE photographer_id = $1 AND custom_for_user_id IS NULL",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    ),
  ]);

  const onboardingChecks = {
    avatar: !!profile.avatar_url,
    cover: !!profile.cover_url,
    bio: !!profile.bio && profile.bio.length > 10,
    portfolio: parseInt(portfolioCount?.count || "0", 10),
    packages: parseInt(packageCount?.count || "0", 10),
    locations: parseInt(locationCount?.count || "0", 10),
    // Same checklist slot, different meaning per market: a completed Stripe
    // Connect account in Portugal, bank details on file in Spain. Keeping one
    // key means the "all steps complete" logic below and the admin approval
    // gate stay in agreement about what "ready to be paid" means.
    stripeConnected: isPayoutReady(profile),
    phone: !!profile.phone,
  };

  // Stage one deliberately excludes Stripe — see lib/onboarding-stage.ts.
  // Connecting a bank account is what stalled applications, so it moved
  // behind approval and is no longer a condition for asking to be reviewed.
  const allStepsComplete = onboardingChecks.avatar && onboardingChecks.cover && onboardingChecks.bio
    && onboardingChecks.portfolio >= MIN_PORTFOLIO_PHOTOS && onboardingChecks.packages >= 1
    && onboardingChecks.locations >= 1 && onboardingChecks.phone;

  const stage = onboardingStage(profile);
  const stripeDaysLeft = daysUntilStripeDeadline(profile.stripe_deadline_at);

  return (
    <div className="p-6 sm:p-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-gray-900">{t("welcomeBack", { name })}</h1>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase text-primary-600">
            {profile.plan}
          </span>
        </div>
        <p className="mt-1 text-gray-500">{t("managePhotographyBusiness")}</p>
      </div>

      {/* Calendar disconnected — sits above the checklist because stale busy
          slots can cost a double-booking, which outranks profile polish. */}
      {brokenCalendar && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {t("calendarBrokenTitle", {
                    name: brokenCalendar.display_name || (brokenCalendar.type === "google" ? "Google Calendar" : "iCal"),
                  })}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {t("calendarBrokenBody", { days: brokenCalendar.days })}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/calendar-sync"
              className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {t("calendarBrokenCta")}
            </Link>
          </div>
        </div>
      )}

      {/* Onboarding Checklist */}
      <div className="mt-6">
        <OnboardingChecklist role="photographer" checks={onboardingChecks} userId={userId} createdAt={profile.created_at} isApproved={profile.is_approved} />
      </div>

      {/* Revision checklist — show when revisions exist */}
      {profile.revision_status && (
        <div className="mt-4">
          <RevisionChecklist />
        </div>
      )}

      {/* Stage one is finished but nobody has been told yet — the ask is an
          explicit button so the photographer sees where their work went. */}
      {stage === "building" && allStepsComplete && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          {/* Stacked, not side by side. The right-hand slot used to hold a
              small button and now holds a whole attestation card — with
              `shrink-0` it refused to narrow, squeezed the message into a
              column four characters wide and pushed its own edge outside the
              banner. A card belongs under the sentence that introduces it. */}
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-800">{t("readyToSubmitTitle")}</p>
              <p className="mt-1 text-sm text-green-700">{t("readyToSubmitBody")}</p>
            </div>
          </div>
          <div className="mt-3">
            <RequestApprovalButton countryName={country.countryName[locale as keyof typeof country.countryName] ?? country.areaServed} />
          </div>
        </div>
      )}

      {/* Approved once, hidden now: the loudest thing on the page, because
          the photographer's profile has silently vanished from the site and
          exactly one action brings it back. */}
      {stage === "hidden_no_stripe" && (
        <div className="mt-4 rounded-xl border-2 border-red-500 bg-red-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-6 w-6 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div>
                <p className="text-base font-extrabold uppercase tracking-wide text-red-700">{t("profileHiddenTitle")}</p>
                <p className="mt-2 text-sm text-red-800">{t("profileHiddenBody")}</p>
              </div>
            </div>
            <Link
              href="/dashboard/payouts"
              className="shrink-0 rounded-lg bg-red-600 px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-red-700"
            >
              {t("profileHiddenCta")}
            </Link>
          </div>
        </div>
      )}

      {stage === "in_review" && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-800">{t("inReviewTitle")}</p>
              <p className="mt-1 text-sm text-blue-700">{t("inReviewBody")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Approved and live, but unpayable. Deliberately loud: bookings can
          arrive before this is done, and the money then waits. */}
      {stage === "awaiting_stripe" && profile.stripe_deadline_at && (
        <div className={`mt-4 rounded-xl border p-4 ${
          (stripeDaysLeft ?? 0) <= 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <svg className={`mt-0.5 h-5 w-5 shrink-0 ${(stripeDaysLeft ?? 0) <= 0 ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
              </svg>
              <div>
                <p className={`text-sm font-semibold ${(stripeDaysLeft ?? 0) <= 0 ? "text-red-800" : "text-amber-900"}`}>
                  {(stripeDaysLeft ?? 0) <= 0 ? t("stripeOverdueTitle") : t("stripePendingTitle", { days: stripeDaysLeft ?? 0 })}
                </p>
                <p className={`mt-1 text-sm ${(stripeDaysLeft ?? 0) <= 0 ? "text-red-700" : "text-amber-800"}`}>
                  {(stripeDaysLeft ?? 0) <= 0 ? t("stripeOverdueBody") : t("stripePendingBody")}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/payouts"
              className={`shrink-0 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white transition ${
                (stripeDaysLeft ?? 0) <= 0 ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {t("stripePendingCta")}
            </Link>
          </div>
        </div>
      )}

      {profile.is_approved && profile.session_count === 0 && (
        <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-primary-800">{t("profileApproved")}</p>
              <p className="mt-1 text-sm text-primary-700">{t("profileApprovedDescription")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action needed */}
      {tasks.length > 0 && (
        <div className="mt-6">
          <ActionNeededWidget tasks={tasks} />
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("statRating"), value: profile.rating ? `${profile.rating}/5` : "—" },
          { label: t("statReviews"), value: profile.review_count },
          { label: t("statTotalBookings"), value: totalBookings?.count || "0" },
          { label: t("statPending"), value: pendingBookings?.count || "0" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar — bookings, deliveries, and busy days at a glance */}
      {profile.is_approved && (
        <div className="mt-6">
          <PhotographerCalendarWidget />
        </div>
      )}

      {/* Plan */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-warm-200 bg-white p-4">
        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase text-primary-600">
          {profile.plan} plan
        </span>
        <span className="text-sm text-gray-500">
          {profile.plan === "free" ? t("upgradePrompt") : t("activeSubscription")}
        </span>
        {profile.plan === "free" && (
          <Link href="/dashboard/subscriptions" className="ml-auto text-sm font-semibold text-primary-600 hover:text-primary-700">
            {t("upgrade")}
          </Link>
        )}
      </div>

      {/* Add-ons promo — show when not both active */}
      {(!profile.is_verified || !profile.is_featured) && profile.is_approved && (
        <div className="mt-6 rounded-xl border border-warm-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-yellow-100">
              <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t("boostVisibility")}</h3>
              <p className="text-xs text-gray-500">{t("boostVisibilityDesc")}</p>
            </div>
          </div>
          <AddOnsSection
            isVerified={profile.is_verified}
            isFeatured={profile.is_featured}
            phoneVerified={profile.phone_verified}
            phoneNumber={profile.phone_number}
            compact
          />
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/support" className="text-sm text-gray-400 hover:text-primary-600">
          {t("needHelp")} {t("helpCenterLink")} &rarr;
        </Link>
      </div>
    </div>
  );
}

function OverviewCard({ href, title, description, icon, accent }: {
  href: string; title: string; description: string; icon: string; accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-5 transition hover:shadow-md ${
        accent ? "border-primary-200 bg-primary-50" : "border-warm-200 bg-white"
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? "bg-primary-100" : "bg-warm-100"}`}>
        <OverviewIcon type={icon} accent={accent} />
      </div>
      <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </Link>
  );
}

function OverviewIcon({ type, accent }: { type: string; accent?: boolean }) {
  const cls = `h-5 w-5 ${accent ? "text-primary-600" : "text-gray-400"}`;
  switch (type) {
    case "search": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "calendar": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "chat": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "user": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    default: return null;
  }
}
