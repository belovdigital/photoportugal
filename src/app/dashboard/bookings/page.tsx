import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { ReviewForm } from "@/components/ui/ReviewForm";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function BookingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  const isPhotographer = user?.role === "photographer";

  let bookings: {
    id: string;
    other_name: string;
    other_slug: string;
    other_avatar: string | null;
    package_name: string | null;
    status: string;
    shoot_date: string | null;
    shoot_time: string | null;
    total_price: number | null;
    message: string | null;
    created_at: string;
    has_review: boolean;
  }[] = [];

  try {
    if (isPhotographer) {
      const profile = await queryOne<{ id: string }>("SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]);
      if (profile) {
        bookings = await query(
          `SELECT b.id, u.name as other_name, '' as other_slug, u.avatar_url as other_avatar,
                  p.name as package_name, b.status, b.shoot_date, b.shoot_time, b.total_price, b.message, b.created_at,
                  FALSE as has_review
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.photographer_id = $1
           ORDER BY b.created_at DESC`,
          [profile.id]
        );
      }
    } else {
      bookings = await query(
        `SELECT b.id, pp.display_name as other_name, pp.slug as other_slug, u.avatar_url as other_avatar,
                p.name as package_name, b.status, b.shoot_date, b.shoot_time, b.total_price, b.message, b.created_at,
                (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) > 0 as has_review
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users u ON u.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE b.client_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }
  } catch {}

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {isPhotographer ? "Booking Requests" : "My Bookings"}
      </h1>
      <p className="mt-1 text-gray-500">
        {isPhotographer ? "Manage incoming requests from clients" : "Track your photoshoot bookings"}
      </p>

      {bookings.length > 0 ? (
        <div className="mt-6 space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-warm-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                    {booking.other_avatar ? (
                      <img src={booking.other_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      booking.other_name.charAt(0)
                    )}
                  </div>
                  <div>
                    {booking.other_slug ? (
                      <Link href={`/photographers/${booking.other_slug}`} className="font-semibold text-gray-900 hover:text-primary-600">
                        {booking.other_name}
                      </Link>
                    ) : (
                      <p className="font-semibold text-gray-900">{booking.other_name}</p>
                    )}
                    {booking.package_name && (
                      <p className="text-sm text-gray-500">{booking.package_name}</p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || STATUS_STYLES.pending}`}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                {booking.shoot_date && (
                  <span>{new Date(booking.shoot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                )}
                {booking.shoot_time && <span>{booking.shoot_time}</span>}
                {booking.total_price && <span>&euro;{booking.total_price}</span>}
                <span>Requested {new Date(booking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>

              {booking.message && (
                <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/messages?chat=${booking.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Message
                </Link>
                {!isPhotographer && booking.status === "completed" && !booking.has_review && (
                  <ReviewForm bookingId={booking.id} photographerName={booking.other_name} />
                )}
                {booking.has_review && (
                  <span className="flex items-center gap-1 px-2 text-sm text-green-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Reviewed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
          <p className="text-gray-400">
            {isPhotographer
              ? "No booking requests yet. Make sure your profile and packages are set up!"
              : "No bookings yet."}
          </p>
          {!isPhotographer && (
            <Link href="/photographers" className="mt-4 inline-flex rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Browse Photographers
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
