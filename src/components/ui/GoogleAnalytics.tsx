"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const GA_ID = "G-DV5MQ9MZ54";

export function GoogleAnalytics() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    setConsent(localStorage.getItem("cookie-consent"));
    function onConsentUpdate() {
      setConsent(localStorage.getItem("cookie-consent"));
    }
    window.addEventListener("cookie-consent-update", onConsentUpdate);
    return () => window.removeEventListener("cookie-consent-update", onConsentUpdate);
  }, []);

  // Only load GA4 if user accepted all cookies
  if (consent !== "accepted") return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
