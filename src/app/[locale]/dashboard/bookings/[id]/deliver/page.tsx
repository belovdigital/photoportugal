import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { DeliveryUploadClient } from "./DeliveryUploadClient";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function DeliverPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const t = await getTranslations("delivery");
  const locale = await getLocale();
  const dateLocale = ({pt:"pt-PT",de:"de-DE",es:"es-ES",fr:"fr-FR",en:"en-US"} as Record<string,string>)[locale] || "en-US";
  const { id } = await params;
  const userId = (session.user as { id?: string }).id;

  const booking = await queryOne<{
    id: string;
    photographer_user_id: string;
    client_name: string;
    package_name: string | null;
    shoot_date: string | null;
    status: string;
    delivery_token: string | null;
    delivery_accepted: boolean;
  }>(
    `SELECT b.id, u.id as photographer_user_id, cu.name as client_name,
            p.name as package_name, b.shoot_date, b.status, b.delivery_token,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.id = $1`, [id]
  );

  if (!booking || booking.photographer_user_id !== userId) redirect("/dashboard/bookings");
  if (!["completed", "delivered"].includes(booking.status)) redirect("/dashboard/bookings");

  const photos = await query<{ id: string; url: string; filename: string; file_size: number }>(
    "SELECT id, url, filename, file_size FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at",
    [id]
  );

  return (
    <div className="p-6 sm:p-8">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("backToBookings")}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-gray-900">
        {t("deliverPhotos")}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>{t("client")} <strong className="text-gray-900">{booking.client_name}</strong></span>
        {booking.package_name && <span>{t("package")} {booking.package_name}</span>}
        {booking.shoot_date && (
          <span>{new Date(booking.shoot_date).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}</span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          booking.status === "delivered" ? "bg-accent-100 text-accent-700" : "bg-blue-100 text-blue-700"
        }`}>
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </span>
      </div>

      <DeliveryUploadClient
        bookingId={id}
        initialPhotos={photos}
        isDelivered={booking.status === "delivered"}
        clientAccepted={booking.delivery_accepted}
        deliveryToken={booking.delivery_token}
      />
    </div>
  );
}
