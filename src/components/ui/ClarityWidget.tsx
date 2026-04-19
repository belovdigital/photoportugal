"use client";

import Script from "next/script";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const CLARITY_ID = "we7hzvxpom";

export function ClarityWidget() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const id = process.env.NEXT_PUBLIC_CLARITY_ID || CLARITY_ID;
  if (!id) return null;

  if (status === "loading") return null;
  if (pathname?.startsWith("/admin")) return null;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin" || role === "photographer") return null;

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
