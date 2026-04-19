"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const CLARITY_ID = "we7hzvxpom";

/**
 * Microsoft Clarity — session recordings + heatmaps.
 * GDPR-gated: only loads after user accepts cookies (same as GoogleAnalytics).
 */
export function ClarityWidget() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    setConsent(localStorage.getItem("cookie-consent"));
    const onConsentUpdate = () => setConsent(localStorage.getItem("cookie-consent"));
    window.addEventListener("cookie-consent-update", onConsentUpdate);
    return () => window.removeEventListener("cookie-consent-update", onConsentUpdate);
  }, []);

  if (consent !== "accepted") return null;

  const id = process.env.NEXT_PUBLIC_CLARITY_ID || CLARITY_ID;
  if (!id) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
