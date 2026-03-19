import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { PayButton } from "@/components/ui/PayButton";
import { BookingStatusButtons } from "./BookingStatusButtons";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  inquiry: "bg-purple-100 text-purple-700",
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  delivered: "bg-accent-100 text-accent-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TIME_LABELS: Record<string, string> = {
  sunrise: "Sunrise (6-8 AM)",
  morning: "Morning (8-11 AM)",
  midday: "Midday (11 AM-2 PM)",
  afternoon: "Afternoon (2-5 PM)",
  golden_hour: "Golden Hour (5-7 PM)",
  sunset: "Sunset (7-9 PM)",
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
    group_size: number | null;
    occasion: string | null;
    total_price: number | null;
    message: string | null;
    created_at: string;
    has_review: boolean;
    payment_status: string | null;
    delivery_token: string | null;
    delivery_accepted: boolean;
    payment_url: string | null;
  }[] = [];

  try {
    if (isPhotographer) {
      const profile = await queryOne<{ id: string }>("SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]);
      if (profile) {
        bookings = await query(
          `SELECT b.id, u.name as other_name, '' as other_slug, u.avatar_url as other_avatar,
                  p.name as package_name, b.status, b.shoot_date, b.shoot_time, b.group_size, b.occasion, b.total_price, b.message, b.created_at, b.payment_status,
                  FALSE as has_review, b.delivery_token,
                  COALESCE(b.delivery_accepted, FALSE) as delivery_accepted, b.payment_url
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
                p.name as package_name, b.status, b.shoot_date, b.shoot_time, b.group_size, b.occasion, b.total_price, b.message, b.created_at, b.payment_status,
                (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) > 0 as has_review, b.delivery_token,
                COALESCE(b.delivery_accepted, FALSE) as delivery_accepted, b.payment_url
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
      <h1 className="font-display text-2xl font-bold text-gray-900">
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
                  <Avatar src={booking.other_avatar} fallback={booking.other_name} size="md" />
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || STATUS_STYLES.pending}`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                  {booking.payment_status === "paid" && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Paid</span>
                  )}
                  {booking.payment_status === "refunded" && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">Refunded</span>
                  )}
                  {booking.status !== "cancelled" && booking.total_price && booking.payment_status !== "paid" && booking.payment_status !== "refunded" && booking.status !== "pending" && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Unpaid</span>
                  )}
                  {booking.delivery_accepted && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Accepted</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                {booking.shoot_date && (
                  <span>{new Date(booking.shoot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                )}
                {booking.shoot_time && <span>{TIME_LABELS[booking.shoot_time] || booking.shoot_time}</span>}
                {booking.group_size && booking.group_size > 1 && <span>{booking.group_size} people</span>}
                {booking.occasion && <span className="capitalize">{booking.occasion}</span>}
                {booking.total_price && <span>&euro;{booking.total_price}</span>}
                <span>Requested {new Date(booking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>

              {booking.message && (
                <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {isPhotographer && (booking.status === "inquiry" || booking.status === "pending" || booking.status === "confirmed" || booking.status === "completed" || booking.status === "delivered") && (
                  <BookingStatusButtons bookingId={booking.id} currentStatus={booking.status} />
                )}
                <Link
                  href={`/dashboard/messages?chat=${booking.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Message
                </Link>
                {!isPhotographer && booking.status === "confirmed" && booking.payment_status !== "paid" && booking.total_price && (
                  booking.payment_url ? (
                    <a
                      href={booking.payment_url}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay Now
                    </a>
                  ) : (
                    <PayButton bookingId={booking.id} amount={Number(booking.total_price)} />
                  )
                )}
                {!isPhotographer && (booking.status === "pending" || booking.status === "confirmed") && (
                  <BookingStatusButtons bookingId={booking.id} currentStatus="cancel-only" paymentStatus={booking.payment_status} />
                )}
                {!isPhotographer && booking.status === "delivered" && booking.delivery_token && (
                  <Link
                    href={`/delivery/${booking.delivery_token}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    View Photos
                  </Link>
                )}
                {!isPhotographer && (booking.status === "completed" || booking.status === "delivered") && !booking.has_review && (
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
