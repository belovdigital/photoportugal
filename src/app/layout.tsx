import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/providers/SessionProvider";

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
    default: "Photo Portugal — Find Your Perfect Photographer in Portugal",
    template: "%s | Photo Portugal",
  },
  description:
    "Book professional photographers across Portugal for vacation photoshoots, couples sessions, family portraits & more. Verified reviews, instant booking.",
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
    title: "Photo Portugal — Find Your Perfect Photographer in Portugal",
    description: "Book professional photographers across Portugal for vacation photoshoots, couples sessions, family portraits & more.",
    url: "https://photoportugal.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Photo Portugal — Find Your Perfect Photographer in Portugal",
    description: "Book professional photographers across Portugal.",
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
      <body className="font-sans">
        <SessionProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
