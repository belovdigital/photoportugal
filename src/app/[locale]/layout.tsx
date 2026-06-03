import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GiftModeBanner } from "@/components/ui/GiftModeBanner";
import { getActiveGiftCard } from "@/lib/gift-card-session";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { GoogleAnalytics } from "@/components/ui/GoogleAnalytics";
import { ClarityWidget } from "@/components/ui/ClarityWidget";
// ExitIntentPopup removed 2026-05-07 — stats showed near-zero conversion
// and visitor feedback flagged it as annoying. Component file kept on disk
// in case we want to revive a different exit-intent experiment later.
import { VisitorTracker } from "@/components/ui/VisitorTracker";
import { LazyIntercom } from "@/components/ui/LazyIntercom";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ConciergeDrawerProvider } from "@/components/concierge/ConciergeDrawer";
import { QuickBookingProvider } from "@/components/ui/QuickBookingModal";

type Locale = "en" | "pt";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  // Gift-card recipients in active gift mode see a sticky banner on
  // every page so they don't get lost when browsing locations / spots /
  // home — wherever they navigate, the banner reminds them they have a
  // gift to redeem and offers a "Use later" exit.
  const giftCard = await getActiveGiftCard();

  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProvider>
        <NotificationProvider>
          <ConciergeDrawerProvider>
            <QuickBookingProvider>
            <Header />
            {giftCard && (
              <GiftModeBanner
                buyerName={giftCard.buyerName}
                tierLabel={giftCard.meta.label}
                expiresAt={giftCard.expiresAt}
              />
            )}
            <main className="flex-1 pb-16 sm:pb-24">{children}</main>
            <Footer />
            </QuickBookingProvider>
          </ConciergeDrawerProvider>
        </NotificationProvider>
        <ScrollToTop />
        <CookieConsent />
        <VisitorTracker />
        <GoogleAnalytics />
        <ClarityWidget />
        <LazyIntercom />
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
