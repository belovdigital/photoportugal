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
import Script from "next/script";

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
        <Script
          id="intercom-boot"
          strategy="afterInteractive"
          data-cfasync="false"
          dangerouslySetInnerHTML={{
            __html: `
              (function(){var w=window;var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/d02q0i7w';s.setAttribute('data-cfasync','false');d.head.appendChild(s);s.onload=function(){w.Intercom('boot',{app_id:'d02q0i7w'});fetch('/api/auth/me').then(function(r){return r.json()}).then(function(u){if(u&&u.id){w.Intercom('update',{user_id:u.id,name:u.name||'',email:u.email||'',user_role:u.role||'client'})}}).catch(function(){});}})();
            `,
          }}
        />
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
