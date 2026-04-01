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
import { auth } from "@/lib/auth";
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
  const session = await auth();
  const intercomUser = session?.user as { id?: string; email?: string; name?: string; role?: string } | undefined;

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
          id="intercom-widget"
          strategy="afterInteractive"
          data-cfasync="false"
          dangerouslySetInnerHTML={{
            __html: `
              window.intercomSettings = {
                api_base: "https://api-iam.intercom.io",
                app_id: "d02q0i7w"${intercomUser?.id ? `,
                user_id: "${intercomUser.id}",
                name: ${JSON.stringify(intercomUser.name || "")},
                email: ${JSON.stringify(intercomUser.email || "")},
                user_role: "${intercomUser.role || "client"}"` : ""}
              };
              (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/d02q0i7w';s.setAttribute('data-cfasync','false');var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
            `,
          }}
        />
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
