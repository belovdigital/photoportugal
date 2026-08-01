"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Both IDs were hardcoded, so photospain.co was reporting every Spanish visit
 * into Photo Portugal's GA4 property AND firing Portugal's Google Ads
 * conversion tag. Two markets' traffic in one property cannot be separated
 * after the fact, and the Ads side was worse: Spanish sessions were being
 * counted as conversions against Portuguese ad spend.
 *
 * Defaults are Portugal's existing IDs, so an unset environment reproduces
 * today's Portuguese behaviour exactly. Spain sets its own GA and deliberately
 * sets NO ads ID — it runs no campaigns, and an empty value must not fall back
 * to Portugal's.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-DV5MQ9MZ54";
const ADS_ID = process.env.NEXT_PUBLIC_ADS_ID ?? "AW-18043729532";

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
    const utmSource = sessionStorage.getItem("utm_source") || (sessionStorage.getItem("gclid") ? "google" : null);
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
      {`(function(){function c(k,v){if(!v)return;var e=new Date(Date.now()+90*864e5).toUTCString();document.cookie=k+'='+encodeURIComponent(v)+'; expires='+e+'; path=/; SameSite=Lax'}var p=new URLSearchParams(location.search);var g=p.get('gclid');if(g){sessionStorage.setItem('gclid',g);c('gclid',g)}var s=p.get('utm_source')||(g?'google':null);var m=p.get('utm_medium')||(g?'cpc':null);if(!s)return;var d={utm_source:s,utm_medium:m,utm_campaign:p.get('utm_campaign'),utm_term:p.get('utm_term'),gclid:g,landing_page:location.pathname};['utm_source','utm_medium','utm_campaign','utm_term'].forEach(function(k){if(d[k]){sessionStorage.setItem(k,d[k]);c(k,d[k])}});if(!sessionStorage.getItem('_av')){sessionStorage.setItem('_av','1');fetch('/api/track-visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){})}})();`}
    </Script>
  );

  // GA4/Ads only with cookie consent
  if (consent !== "accepted") return utmScript;

  return (
    <>
      {utmScript}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');${ADS_ID ? `gtag('config','${ADS_ID}');` : ""}`}
      </Script>
    </>
  );
}
