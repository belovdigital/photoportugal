import { queryOne } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function GiftCardSuccess({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ card?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("giftCardsPage");
  const { card } = await searchParams;

  let status: string | null = null;
  let recipientName: string | null = null;
  let recipientEmail: string | null = null;
  let buyerName: string | null = null;

  // Validate UUID shape before hitting the DB — otherwise an attacker
  // (or curl-driven crawler) can trip a 5xx with `?card=anything-not-uuid`
  // because Postgres throws 22P02 on invalid uuid input. Silent fallthrough
  // is the right behaviour: the page already handles "no data" gracefully.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (card && UUID_RE.test(card)) {
    const row = await queryOne<{ status: string; recipient_name: string; recipient_email: string; buyer_name: string }>(
      "SELECT status, recipient_name, recipient_email, buyer_name FROM gift_cards WHERE id = $1",
      [card]
    ).catch(() => null);
    if (row) {
      status = row.status;
      recipientName = row.recipient_name;
      recipientEmail = row.recipient_email;
      buyerName = row.buyer_name;
    }
  }

  const processing = status === "purchased";

  return (
    <main className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="text-5xl mb-4">🎁</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {processing ? t("successProcessing") : t("successDelivered")}
        </h1>
        {recipientName && recipientEmail && buyerName ? (
          <p className="text-base text-gray-600 leading-relaxed">
            {t(processing ? "successProcessingBody" : "successDeliveredBody", {
              recipientName,
              recipientEmail,
              buyerName,
            })}
          </p>
        ) : (
          <p className="text-base text-gray-600 leading-relaxed">
            {t("successGenericBody")}
          </p>
        )}
        <div className="mt-6 space-y-2">
          <Link href="/" className="block text-sm text-primary-600 hover:underline">{t("successBackHome")}</Link>
          <Link href="/gift-cards" className="block text-xs text-gray-500 hover:underline">{t("successSendAnother")}</Link>
        </div>
      </div>
    </main>
  );
}
