"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const GA_ID = "G-DV5MQ9MZ54";
const ADS_ID = "AW-18043729532";

export function GoogleAnalytics() {
  const [consent, setConsent] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setConsent(localStorage.getItem("cookie-consent"));
    function onConsentUpdate() {
      setConsent(localStorage.getItem("cookie-consent"));
    }
    window.addEventListener("cookie-consent-update", onConsentUpdate);
    return () => window.removeEventListener("cookie-consent-update", onConsentUpdate);
  }, []);

  // Track page views for ad visitors
  useEffect(() => {
    if (!pathname) return;
    const utmSource = sessionStorage.getItem("utm_source");
    if (!utmSource) return;
    fetch("/api/track-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, utm_source: utmSource }),
    }).catch(() => {});
  }, [pathname]);

  // UTM tracking runs always (no cookie consent needed — it's our own first-party analytics)
  const utmScript = (
    <Script id="utm-persist" strategy="afterInteractive">
      {`(function(){var p=new URLSearchParams(location.search);var s=p.get('utm_source');if(!s)return;var d={utm_source:s,utm_medium:p.get('utm_medium'),utm_campaign:p.get('utm_campaign'),utm_term:p.get('utm_term'),landing_page:location.pathname};['utm_source','utm_medium','utm_campaign','utm_term'].forEach(function(k){if(d[k])sessionStorage.setItem(k,d[k])});if(!sessionStorage.getItem('_av')){sessionStorage.setItem('_av','1');fetch('/api/track-visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){})}})();`}
    </Script>
  );

  // GA4/Ads only with cookie consent
  if (consent !== "accepted") return utmScript;

  return (
    <>
      {utmScript}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');gtag('config','${ADS_ID}');`}
      </Script>
    </>
  );
}
