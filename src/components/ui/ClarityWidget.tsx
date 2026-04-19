"use client";

import Script from "next/script";

/**
 * Microsoft Clarity — free unlimited session recordings + heatmaps.
 * Loaded with `afterInteractive` so it doesn't block LCP.
 * Project ID read from NEXT_PUBLIC_CLARITY_ID env var.
 */
const CLARITY_ID = "we7hzvxpom";

export function ClarityWidget() {
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
