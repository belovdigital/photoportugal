import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { ReviewForm } from "@/components/ui/ReviewForm";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmed", color: "bg-accent-100 text-accent-700" },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;

  // Role check — photographers go to their dashboard
  try {
    const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
    if (userRow?.role === "photographer") redirect("/dashboard/photographer");
  } catch {}

  let bookings: {
    id: string;
    photographer_name: string;
    photographer_slug: string;
    photographer_avatar: string | null;
    package_name: string | null;
    duration_minutes: number | null;
    num_photos: number | null;
    status: string;
    shoot_date: string | null;
    total_price: number | null;
    message: string | null;
    created_at: string;
    has_review: boolean;
  }[] = [];

  try {
    bookings = await query(
      `SELECT b.id, pp.display_name as photographer_name, pp.slug as photographer_slug,
              u.avatar_url as photographer_avatar,
              p.name as package_name, p.duration_minutes, p.num_photos,
              b.status, b.shoot_date, b.total_price, b.message, b.created_at,
              (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) > 0 as has_review
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.client_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
  } catch {}

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">
          Welcome, {session.user.name}
        </h1>
        <p className="mt-1 text-gray-500">
          Manage your bookings and find your perfect photographer
        </p>
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Link
          href="/photographers"
          className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">Find a Photographer</h3>
          <p className="mt-1 text-sm text-gray-500">Browse portfolios and book your perfect photoshoot</p>
        </Link>

        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100 text-warm-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">My Bookings</h3>
          <p className="mt-1 text-sm text-gray-500">
            {bookings.length > 0 ? `${bookings.length} booking${bookings.length > 1 ? "s" : ""}` : "No bookings yet"}
          </p>
        </div>

        <Link href="/locations" className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100 text-warm-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">Explore Locations</h3>
          <p className="mt-1 text-sm text-gray-500">Discover Portugal&apos;s most photogenic spots</p>
        </Link>
      </div>

      {/* Bookings list */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">My Bookings</h2>
        {bookings.length > 0 ? (
          <div className="mt-4 space-y-4">
            {bookings.map((booking) => {
              const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.pending;
              return (
                <div key={booking.id} className="rounded-xl border border-warm-200 bg-white p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600 overflow-hidden">
                        {booking.photographer_avatar ? (
                          <img src={booking.photographer_avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          booking.photographer_name.charAt(0)
                        )}
                      </div>
                      <div>
                        <Link href={`/photographers/${booking.photographer_slug}`} className="font-semibold text-gray-900 hover:text-primary-600">
                          {booking.photographer_name}
                        </Link>
                        {booking.package_name && (
                          <p className="text-sm text-gray-500">
                            {booking.package_name}
                            {booking.duration_minutes && ` \u00b7 ${booking.duration_minutes} min`}
                            {booking.num_photos && ` \u00b7 ${booking.num_photos} photos`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                    {booking.shoot_date && (
                      <span>
                        Date: {new Date(booking.shoot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {booking.total_price && (
                      <span>&euro;{booking.total_price}</span>
                    )}
                    <span>
                      Requested {new Date(booking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {booking.message && (
                    <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/messages/${booking.id}`}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Message
                    </Link>
                    {booking.status === "completed" && !booking.has_review && (
                      <ReviewForm bookingId={booking.id} photographerName={booking.photographer_name} />
                    )}
                    {booking.has_review && (
                      <span className="flex items-center gap-1 text-sm text-accent-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-warm-200 bg-white p-8 text-center">
            <p className="text-gray-400">
              No bookings yet. Start by{" "}
              <Link href="/photographers" className="text-primary-600 hover:underline">
                browsing photographers
              </Link>
              !
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
