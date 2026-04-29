import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { GoogleAnalytics } from "@/components/ui/GoogleAnalytics";
import { ClarityWidget } from "@/components/ui/ClarityWidget";
import { ExitIntentPopup } from "@/components/ui/ExitIntentPopup";
import { VisitorTracker } from "@/components/ui/VisitorTracker";
import { LazyIntercom } from "@/components/ui/LazyIntercom";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ConciergeDrawerProvider } from "@/components/concierge/ConciergeDrawer";

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

  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProvider>
        <NotificationProvider>
          <ConciergeDrawerProvider>
            <Header />
            <main className="flex-1 pb-16 sm:pb-24">{children}</main>
            <Footer />
            {/* ExitIntentPopup MUST sit inside ConciergeDrawerProvider —
                its submit handler calls `useConciergeDrawer().openWith()`
                to open the AI drawer with the visitor's typed message.
                Outside the provider the hook returns a no-op fallback,
                so submit silently closes the popup without opening the
                drawer. */}
            <ExitIntentPopup />
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
