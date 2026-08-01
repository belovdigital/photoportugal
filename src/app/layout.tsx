import type { Metadata } from "next";
import { country } from "@/lib/country";
import { Inter, Playfair_Display } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: country.seo.title,
    template: `%s | ${country.brand}`,
  },
  description: country.seo.description,
  keywords: country.seo.keywords,
  metadataBase: new URL(country.baseUrl),
  openGraph: {
    type: "website",
    siteName: country.brand,
    title: country.seo.title,
    description: country.seo.ogDescription,
    // NOTE: no `url` and no `locale` here on purpose.
    //
    // A default `url` is not a fallback, it is a wrong answer that never
    // errors: any page that forgets its own openGraph block inherited
    // og:url = the homepage, so /photoshoots, /for-business and /try-yourself
    // all told Facebook and WhatsApp they were the homepage. Omitting it means
    // a page with no OG url simply has none, which is visible and fixable,
    // instead of silently claiming to be a different page.
    //
    // A default `locale` of "en_US" was worse: it was emitted on Spanish,
    // German and French pages, contradicting their own <html lang>. Each page's
    // generateMetadata sets its own.
    images: [{ url: country.ogImage, width: 1200, height: 630, alt: country.brand }],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* R2 CDN — serves every photographer cover + portfolio image.
            Single biggest LCP source on photographer detail pages, so
            preconnect saves ~150-300ms vs cold DNS+TLS. */}
        <link rel="preconnect" href={`https://${country.filesHost}`} />
        <link rel="dns-prefetch" href={`https://${country.filesHost}`} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        {/* Recover from blue-green chunk-mismatch errors. After a deploy
            the visitor's stale HTML may reference chunks (e.g.
            `/_next/static/chunks/<hash>.js`) that no longer exist on
            disk because the new build has different content-hashes.
            Without this, the page silently breaks with
            ChunkLoadError + "Cannot read properties of null (parentNode)".
            We listen for chunk-load errors, and on first hit we force
            a reload. SessionStorage flag prevents an infinite loop if
            the chunk is genuinely missing (corrupt deploy). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (typeof window === "undefined") return;
                function isChunkErr(e){
                  var m = (e && (e.message || (e.reason && e.reason.message))) || "";
                  return /ChunkLoadError|Loading chunk|Failed to load chunk|Loading CSS chunk/.test(m);
                }
                function tryReload(e){
                  if (!isChunkErr(e)) return;
                  try {
                    if (sessionStorage.getItem("chunk_reload_at")) return;
                    sessionStorage.setItem("chunk_reload_at", String(Date.now()));
                    setTimeout(function(){ try { sessionStorage.removeItem("chunk_reload_at"); } catch(_){} }, 60000);
                  } catch(_){}
                  location.reload();
                }
                window.addEventListener("error", tryReload, true);
                window.addEventListener("unhandledrejection", tryReload);
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: country.brand,
              url: country.baseUrl,
              logo: `${country.baseUrl}${country.logoPath}`,
              image: `${country.baseUrl}${country.ogImage}`,
              ...(country.phone ? { telephone: country.phone } : {}),
              email: country.supportEmail,
              areaServed: { "@type": "Country", name: country.areaServed },
              ...(country.socialLinks.length ? { sameAs: country.socialLinks } : {}),
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: country.supportEmail,
                ...(country.phone ? { telephone: country.phone } : {}),
                areaServed: country.code.toUpperCase(),
                availableLanguage: country.contactLanguages,
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
