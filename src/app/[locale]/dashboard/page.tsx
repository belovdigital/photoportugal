import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { RevisionChecklist } from "@/components/dashboard/RevisionChecklist";
import { ActionNeededWidget } from "@/components/dashboard/ActionNeededWidget";
import { AddOnsSection } from "@/app/[locale]/dashboard/subscriptions/AddOnsSection";
import { getPhotographerTasks } from "@/lib/photographer-tasks";
import { getLocale } from "next-intl/server";

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
          {["Lisbon", "Porto", "Algarve", "Sintra", "Madeira", "Azores"].map((city) => (
            <Link
              key={city}
              href={`/locations/${city.toLowerCase()}`}
              className="rounded-full border border-warm-200 px-4 py-2 text-sm text-gray-600 transition hover:border-primary-300 hover:text-primary-600"
            >
              {city}
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
    is_verified: boolean; is_featured: boolean; phone_verified: boolean; phone_number: string | null;
  }>(
    `SELECT pp.id, pp.rating, pp.review_count, pp.session_count, pp.plan, pp.slug, pp.is_approved,
            u.avatar_url, pp.cover_url, pp.bio, pp.stripe_account_id, pp.stripe_onboarding_complete,
            u.phone, pp.created_at, pp.revision_status,
            pp.is_verified, pp.is_featured, pp.phone_verified, pp.phone_number
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

  const locale = await getLocale();
  const tasks = await getPhotographerTasks(profile.id, userId);

  const [pendingBookings, totalBookings, portfolioCount, packageCount, locationCount] = await Promise.all([
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1 AND status = 'pending'",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM portfolio_items WHERE photographer_id = $1",
      [profile.id]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM packages WHERE photographer_id = $1",
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
    stripeConnected: !!profile.stripe_account_id && !!profile.stripe_onboarding_complete,
    phone: !!profile.phone,
  };

  const allStepsComplete = onboardingChecks.avatar && onboardingChecks.cover && onboardingChecks.bio
    && onboardingChecks.portfolio >= 5 && onboardingChecks.packages >= 1
    && onboardingChecks.locations >= 1 && onboardingChecks.stripeConnected && onboardingChecks.phone;

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

      {/* Approval notice — only show when all checklist steps are complete and no revisions */}
      {!profile.is_approved && allStepsComplete && !profile.revision_status && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800">{t("profilePendingApproval")}</p>
              <p className="mt-1 text-sm text-green-700">
                {t("profilePendingDescriptionComplete")}
              </p>
            </div>
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
          <ActionNeededWidget tasks={tasks} locale={locale} />
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

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <OverviewCard href="/dashboard/bookings" title={t("bookings")} description={t("viewManageRequests")} icon="calendar" />
        <OverviewCard href="/dashboard/messages" title={t("messages")} description={t("chatWithClients")} icon="chat" />
        <OverviewCard href="/dashboard/profile" title={t("editProfile")} description={t("updateYourInfo")} icon="user" />
      </div>

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
