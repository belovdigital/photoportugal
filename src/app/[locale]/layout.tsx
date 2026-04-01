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
import { VisitorTracker } from "@/components/ui/VisitorTracker";
import { IntercomWidget } from "@/components/ui/IntercomWidget";

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
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NotificationProvider>
        <CookieConsent />
        <VisitorTracker />
        <GoogleAnalytics />
        <IntercomWidget />
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
