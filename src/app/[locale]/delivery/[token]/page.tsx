import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeliveryPageClient } from "./DeliveryPageClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const booking = await queryOne<{ photographer_name: string }>(
    `SELECT u.name as photographer_name
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.delivery_token = $1`, [token]
  );

  return {
    title: booking ? `Photos by ${booking.photographer_name} — Photo Portugal` : "Photo Delivery — Photo Portugal",
    robots: "noindex, nofollow",
  };
}

export default async function DeliveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Check if gallery exists (without revealing any data)
  const booking = await queryOne<{
    photographer_name: string;
    photographer_avatar: string | null;
    delivery_expires_at: string;
    delivery_title: string | null;
    delivery_message: string | null;
  }>(
    `SELECT u.name as photographer_name, u.avatar_url as photographer_avatar,
            b.delivery_expires_at, b.delivery_title, b.delivery_message
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.delivery_token = $1 AND b.delivery_token IS NOT NULL`, [token]
  );

  if (!booking) notFound();

  const expired = new Date(booking.delivery_expires_at) < new Date();

  if (expired) {
    const t = await getTranslations("delivery");
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900">{t("galleryExpiredTitle")}</h1>
        <p className="mt-2 text-gray-500">{t("galleryExpiredMessage")}</p>
      </div>
    );
  }

  return (
    <DeliveryPageClient
      token={token}
      photographerName={booking.photographer_name}
      photographerAvatar={booking.photographer_avatar}
      deliveryTitle={booking.delivery_title}
      deliveryMessage={booking.delivery_message}
    />
  );
}
