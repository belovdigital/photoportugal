import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";

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

  if (role === "photographer") {
    return <PhotographerOverview userId={userId!} name={name} />;
  }

  return <ClientOverview userId={userId!} name={name} />;
}

async function ClientOverview({ userId, name }: { userId: string; name: string }) {
  const bookingCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM bookings WHERE client_id = $1",
    [userId]
  );

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Welcome back, {name}</h1>
      <p className="mt-1 text-gray-500">Find your perfect photographer in Portugal</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard
          href="/photographers"
          title="Find Photographers"
          description="Browse portfolios and book your session"
          icon="search"
          accent
        />
        <OverviewCard
          href="/dashboard/bookings"
          title="My Bookings"
          description={`${bookingCount?.count || 0} booking${bookingCount?.count === "1" ? "" : "s"}`}
          icon="calendar"
        />
        <OverviewCard
          href="/dashboard/messages"
          title="Messages"
          description="Chat with your photographers"
          icon="chat"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Popular Destinations</h2>
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
    </div>
  );
}

async function PhotographerOverview({ userId, name }: { userId: string; name: string }) {
  const profile = await queryOne<{
    id: string; rating: number; review_count: number; session_count: number; plan: string; slug: string; is_approved: boolean;
  }>(
    "SELECT pp.id, pp.rating, pp.review_count, pp.session_count, pp.plan, pp.slug, pp.is_approved FROM photographer_profiles pp WHERE pp.user_id = $1",
    [userId]
  );

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No photographer profile found.</p>
      </div>
    );
  }

  const pendingBookings = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1 AND status = 'pending'",
    [profile.id]
  );

  const totalBookings = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM bookings WHERE photographer_id = $1",
    [profile.id]
  );

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Welcome back, {name}</h1>
          <p className="mt-1 text-gray-500">Manage your photography business</p>
        </div>
      </div>

      {/* Approval notice */}
      {!profile.is_approved && (
        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-800">Profile pending approval</p>
              <p className="mt-1 text-sm text-yellow-700">
                Your profile is being reviewed by our team. Once approved, it will be visible to clients.
                In the meantime, please complete your profile, upload portfolio photos, and create packages.
              </p>
            </div>
          </div>
        </div>
      )}

      {profile.is_approved && <div className="mt-2 flex justify-end">
        <Link
          href={`/photographers/${profile.slug}`}
          target="_blank"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          View Public Profile
        </Link>
      </div>}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Rating", value: profile.rating ? `${profile.rating}/5` : "—" },
          { label: "Reviews", value: profile.review_count },
          { label: "Total Bookings", value: totalBookings?.count || "0" },
          { label: "Pending", value: pendingBookings?.count || "0" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <OverviewCard href="/dashboard/bookings" title="Bookings" description="View and manage requests" icon="calendar" />
        <OverviewCard href="/dashboard/messages" title="Messages" description="Chat with clients" icon="chat" />
        <OverviewCard href="/dashboard/profile" title="Edit Profile" description="Update your info" icon="user" />
      </div>

      {/* Plan */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-warm-200 bg-white p-4">
        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase text-primary-600">
          {profile.plan} plan
        </span>
        <span className="text-sm text-gray-500">
          {profile.plan === "free" ? "Upgrade to get more visibility and features" : "Active subscription"}
        </span>
        {profile.plan === "free" && (
          <Link href="/dashboard/subscription" className="ml-auto text-sm font-semibold text-primary-600 hover:text-primary-700">
            Upgrade
          </Link>
        )}
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
