import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { PayButton } from "@/components/ui/PayButton";
import { BookingStatusButtons } from "./BookingStatusButtons";
import { DateNegotiation } from "./DateNegotiation";
import { Avatar } from "@/components/ui/Avatar";
import { PaymentTracker } from "./PaymentTracker";
import { BookingJourney } from "./BookingJourney";
import { normalizeName } from "@/lib/format-name";

export const dynamic = "force-dynamic";

const STATUS_LABEL_KEYS: Record<string, string> = {
  inquiry: "statusInquiry",
  pending: "statusPending",
  confirmed: "statusConfirmed",
  completed: "statusCompleted",
  delivered: "statusDelivered",
  cancelled: "statusCancelled",
};

const TIME_LABEL_KEYS: Record<string, string> = {
  sunrise: "timeSunrise",
  morning: "timeMorning",
  midday: "timeMidday",
  afternoon: "timeAfternoon",
  golden_hour: "timeGoldenHour",
  sunset: "timeSunset",
};

const STATUS_STYLES: Record<string, string> = {
  inquiry: "bg-purple-100 text-purple-700",
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  delivered: "bg-accent-100 text-accent-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function BookingsPage() {
  const session = await auth();
  const t = await getTranslations("bookings");
  const locale = await getLocale();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
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
    flexible_date_from: string | null;
    flexible_date_to: string | null;
    proposed_date: string | null;
    proposed_by: string | null;
    proposed_time: string | null;
    date_note: string | null;
    group_size: number | null;
    occasion: string | null;
    total_price: number | null;
    service_fee: number | null;
    payout_amount: number | null;
    duration_minutes: number | null;
    location_slug: string | null;
    location_detail: string | null;
    message: string | null;
    created_at: string;
    client_country: string | null;
    has_review: boolean;
    payment_status: string | null;
    delivery_token: string | null;
    delivery_accepted: boolean;
    payment_url: string | null;
    updated_at: string;
  }[] = [];

  try {
    if (isPhotographer) {
      const profile = await queryOne<{ id: string }>("SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]);
      if (profile) {
        bookings = await query(
          `SELECT b.id, u.name as other_name, '' as other_slug, u.avatar_url as other_avatar,
                  p.name as package_name, p.duration_minutes, b.status, b.shoot_date, b.shoot_time, b.flexible_date_from, b.flexible_date_to, b.proposed_date, b.proposed_by, b.proposed_time, b.date_note, b.group_size, b.occasion, b.total_price, b.service_fee, b.payout_amount, b.location_slug, b.location_detail, b.message, b.created_at, b.payment_status,
                  FALSE as has_review, b.delivery_token,
                  COALESCE(b.delivery_accepted, FALSE) as delivery_accepted, b.payment_url, b.updated_at,
                  (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = b.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1) as client_country
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.photographer_id = $1 AND b.status != 'inquiry'
           ORDER BY b.created_at DESC`,
          [profile.id]
        );
      }
    } else {
      bookings = await query(
        `SELECT b.id, u.name as other_name, pp.slug as other_slug, u.avatar_url as other_avatar,
                p.name as package_name, p.duration_minutes, b.status, b.shoot_date, b.shoot_time, b.flexible_date_from, b.flexible_date_to, b.proposed_date, b.proposed_by, b.proposed_time, b.date_note, b.group_size, b.occasion, b.total_price, b.service_fee, b.payout_amount, b.location_slug, b.location_detail, b.message, b.created_at, b.payment_status,
                (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) > 0 as has_review, b.delivery_token,
                COALESCE(b.delivery_accepted, FALSE) as delivery_accepted, b.payment_url, b.updated_at
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users u ON u.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
         WHERE b.client_id = $1 AND b.status != 'inquiry'
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }
  } catch {}

  // Serialize Date objects to strings (node-postgres returns date columns as Date objects)
  for (const b of bookings) {
    const rec = b as Record<string, unknown>;
    for (const key of ["shoot_date", "proposed_date", "flexible_date_from", "flexible_date_to", "created_at"]) {
      const val = rec[key];
      if (val && typeof val === "object" && "toISOString" in (val as object)) rec[key] = (val as Date).toISOString();
    }
  }

  const bookingAmounts = Object.fromEntries(bookings.map((b) => [b.id, Number(b.total_price) || 0]));

  return (
    <div className="p-6 sm:p-8">
      <PaymentTracker bookingAmounts={bookingAmounts} />
      <h1 className="font-display text-2xl font-bold text-gray-900">
        {isPhotographer ? t("bookingRequests") : t("myBookings")}
      </h1>
      <p className="mt-1 text-gray-500">
        {isPhotographer ? t("manageIncoming") : t("trackBookings")}
      </p>

      {bookings.length > 0 ? (
        <div className="mt-6 space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-warm-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={booking.other_avatar} fallback={normalizeName(booking.other_name)} size="md" />
                  <div>
                    {booking.other_slug ? (
                      <Link href={`/photographers/${booking.other_slug}`} className="font-semibold text-gray-900 hover:text-primary-600">
                        {normalizeName(booking.other_name)}
                      </Link>
                    ) : (
                      <p className="font-semibold text-gray-900">{normalizeName(booking.other_name)}</p>
                    )}
                    {booking.package_name && (
                      <p className="text-sm text-gray-500">{booking.package_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {booking.status === "cancelled" && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{t("statusCancelled")}</span>
                  )}
                  {booking.payment_status === "refunded" && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{t("refunded")}</span>
                  )}
                </div>
              </div>

              {booking.status !== "cancelled" && (
                <BookingJourney
                  status={booking.status}
                  paymentStatus={booking.payment_status}
                  deliveryAccepted={booking.delivery_accepted}
                  isPhotographer={isPhotographer}
                  shootDate={booking.shoot_date}
                  deliveryToken={booking.delivery_token}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {isPhotographer && (booking.status === "pending" || booking.status === "confirmed" || booking.status === "completed" || booking.status === "delivered") && (
                        <BookingStatusButtons bookingId={booking.id} currentStatus={booking.status} deliveryAccepted={booking.delivery_accepted} shootDate={booking.shoot_date} />
                      )}
                      {!isPhotographer && booking.status === "confirmed" && booking.payment_status !== "paid" && booking.total_price && (
                        <PayButton bookingId={booking.id} amount={Number(booking.total_price)} />
                      )}
                      {!isPhotographer && booking.status === "delivered" && booking.delivery_token && (
                        <Link
                          href={`/delivery/${booking.delivery_token}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                        >
                          {t("viewPhotos")}
                        </Link>
                      )}
                    </div>
                  }
                />
              )}

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(booking.shoot_date || (booking.flexible_date_from && booking.flexible_date_to)) && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("shootDate") || "Date"}</p>
                    <p className="text-sm font-medium text-gray-800">
                      {booking.shoot_date
                        ? new Date(booking.shoot_date).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                        : t("flexibleRange", { from: new Date(booking.flexible_date_from!).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }), to: new Date(booking.flexible_date_to!).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) })}
                    </p>
                    {booking.shoot_time && (
                      <p className="text-xs text-gray-500">{TIME_LABEL_KEYS[booking.shoot_time] ? t(TIME_LABEL_KEYS[booking.shoot_time]) : booking.shoot_time}</p>
                    )}
                  </div>
                )}
                {booking.total_price && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("price") || "Price"}</p>
                    <p className="text-sm font-medium text-gray-800">&euro;{Math.round(Number(booking.total_price))}</p>
                    {isPhotographer && (Number(booking.service_fee) > 0 || Number(booking.payout_amount) > 0) && (
                      <p className="text-[10px] text-gray-400">Fee: &euro;{Math.round(Number(booking.service_fee))} &middot; Payout: &euro;{Math.round(Number(booking.payout_amount))}</p>
                    )}
                  </div>
                )}
                {booking.package_name && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("packageLabel") || "Package"}</p>
                    <p className="text-sm font-medium text-gray-800">{booking.package_name}</p>
                    {booking.duration_minutes && <p className="text-xs text-gray-500">{booking.duration_minutes < 60 ? `${booking.duration_minutes} min` : `${booking.duration_minutes / 60}h`}</p>}
                  </div>
                )}
                {booking.location_slug && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("locationLabel") || "Location"}</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">{booking.location_slug.replace(/-/g, " ")}</p>
                    {booking.location_detail && <p className="text-xs text-gray-500">{booking.location_detail}</p>}
                  </div>
                )}
                {booking.occasion && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("occasion") || "Occasion"}</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">{booking.occasion}</p>
                  </div>
                )}
                {booking.group_size && booking.group_size > 1 && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("groupLabel") || "Group"}</p>
                    <p className="text-sm font-medium text-gray-800">{booking.group_size} {t("people", { count: booking.group_size }) || "people"}</p>
                  </div>
                )}
                <div className="rounded-lg bg-warm-50 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("requestedLabel") || "Requested"}</p>
                  <p className="text-sm font-medium text-gray-800">{new Date(booking.created_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                {isPhotographer && booking.client_country && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client</p>
                    <p className="text-sm font-medium text-gray-800">{booking.client_country.toUpperCase().replace(/./g, (c: string) => String.fromCodePoint(127397 + c.charCodeAt(0)))} {(() => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(booking.client_country!); } catch { return booking.client_country; } })()}</p>
                  </div>
                )}
              </div>

              {booking.message && (
                <p className="mt-3 rounded-lg bg-warm-50 px-3 py-2 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
              )}

              {booking.status === "confirmed" && booking.payment_status !== "paid" && booking.total_price && (() => {
                const confirmedAt = new Date(booking.updated_at);
                const deadline = new Date(confirmedAt.getTime() + 48 * 60 * 60 * 1000);
                const now = new Date();
                const hoursRemaining = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
                if (hoursRemaining > 0) {
                  return (
                    <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                      <strong>{t("paymentDueLabel") || "Payment due"}</strong>{" "}
                      {t("paymentDueMessage", { hours: hoursRemaining }) || `within ${hoursRemaining} hours. Your booking will be automatically cancelled if not paid.`}
                    </div>
                  );
                }
                return (
                  <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <strong>{t("paymentOverdueLabel") || "Payment overdue"}</strong>{" "}
                    {t("paymentOverdueMessage") || "Your booking may be cancelled at any time. Please pay immediately to avoid cancellation."}
                  </div>
                );
              })()}

              {!["cancelled", "completed", "delivered"].includes(booking.status) && (
                <DateNegotiation
                  bookingId={booking.id}
                  shootDate={booking.shoot_date}
                  proposedDate={booking.proposed_date}
                  proposedBy={booking.proposed_by}
                  proposedTime={booking.proposed_time}
                  dateNote={booking.date_note}
                  isPhotographer={isPhotographer}
                  otherName={normalizeName(booking.other_name).split(" ")[0]}
                />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/messages?chat=${booking.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  {t("message")}
                </Link>
                {!isPhotographer && (booking.status === "pending" || booking.status === "confirmed") && (
                  <BookingStatusButtons bookingId={booking.id} currentStatus="cancel-only" paymentStatus={booking.payment_status} />
                )}
                {!isPhotographer && (booking.status === "completed" || booking.status === "delivered") && !booking.has_review && (
                  <ReviewForm bookingId={booking.id} photographerName={normalizeName(booking.other_name)} />
                )}
                {booking.has_review && (
                  <span className="flex items-center gap-1 px-2 text-sm text-green-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {t("reviewed")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center py-16 text-center">
          <svg className="h-12 w-12 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {isPhotographer ? t("noBookingsPhotographer") : t("noBookingsClient")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isPhotographer
              ? t("noBookingsPhotographerDesc")
              : t("noBookingsClientDesc")}
          </p>
          {!isPhotographer && (
            <a href="/photographers" className="mt-4 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">{t("browsePhotographers")}</a>
          )}
        </div>
      )}
    </div>
  );
}
