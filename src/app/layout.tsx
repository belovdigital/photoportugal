import type { Metadata } from "next";
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
    default: "Vacation Photographer Portugal — Book Professional Photoshoots | Photo Portugal",
    template: "%s | Photo Portugal",
  },
  description:
    "Book a hand-picked vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & 25+ locations. Every photographer personally vetted. Verified reviews, secure payments, private photo gallery. From EUR150.",
  keywords: [
    "photographer portugal",
    "vacation photographer lisbon",
    "photoshoot portugal",
    "couples photographer porto",
    "family photographer algarve",
    "professional photographer portugal",
  ],
  metadataBase: new URL("https://photoportugal.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Photo Portugal",
    title: "Vacation Photographer Portugal — Book Professional Photoshoots | Photo Portugal",
    description: "Book a professional vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & 25+ locations.",
    url: "https://photoportugal.com",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Photo Portugal" }],
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
        <link rel="preload" href="/hero-family.webp" as="image" type="image/webp" fetchPriority="high" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Photo Portugal",
              url: "https://photoportugal.com",
              logo: "https://photoportugal.com/logo.svg",
              sameAs: [
                "https://instagram.com/photoportugal",
                "https://facebook.com/photoportugal",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: "info@photoportugal.com",
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
