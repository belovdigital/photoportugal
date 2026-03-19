import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { CookieConsent } from "@/components/ui/CookieConsent";

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
    "Book a professional vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & 25+ locations. Verified reviews, secure Stripe payments, private photo gallery. From EUR150.",
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
    description: "Book a professional vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & 25+ locations. Verified reviews, secure Stripe payments, private photo gallery. From EUR150.",
    url: "https://photoportugal.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Photo Portugal — Find Your Perfect Photographer in Portugal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Photo Portugal — Find Your Perfect Photographer in Portugal",
    description: "Book professional photographers across Portugal.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://photoportugal.com",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
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
                email: "hello@photoportugal.com",
              },
            }),
          }}
        />
        <SessionProvider>
          <NotificationProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </NotificationProvider>
          <CookieConsent />
        </SessionProvider>
      </body>
    </html>
  );
}
