"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { locations } from "@/lib/locations-data";

const TOP_LOCATIONS = ["lisbon", "porto", "algarve", "sintra", "madeira", "azores", "cascais", "lagos"];

export function Footer() {
  const t = useTranslations("footer");
  const topLocations = locations.filter((l) => TOP_LOCATIONS.includes(l.slug));

  return (
    <>
    {/* Pre-footer: Mobile App CTA */}
    <section className="border-t border-warm-200 bg-gradient-to-b from-warm-50 to-warm-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-sm">
              <img src="/logo-icon.png" alt="" className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("appTitle")}
            </h2>
          </div>
          <p className="max-w-md text-gray-500">
            {t("appSubtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-1">
            <a
              href="https://apps.apple.com/app/photo-portugal/id6761375811"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:scale-105 active:scale-95"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-12"
              />
            </a>
            <div className="relative">
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="h-[58px] opacity-30 grayscale"
              />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warm-200/80 px-2.5 py-0.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer className="border-t border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Photo Portugal"
                width={180}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              {t("tagline")}
            </p>
          </div>

          {/* Locations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("topLocations")}
            </h3>
            <ul className="mt-3 space-y-2">
              {topLocations.map((loc) => (
                <li key={loc.slug}>
                  <Link
                    href={`/locations/${loc.slug}`}
                    className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block"
                  >
                    {t("photographersIn", { location: loc.name })}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/locations"
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700 py-1 inline-block"
                >
                  {t("viewAllLocations", { count: locations.length })}
                </Link>
              </li>
            </ul>
          </div>

          {/* For Photographers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("forPhotographers")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/for-photographers/join"
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block"
                >
                  {t("joinAsPhotographer")}
                </Link>
              </li>
              <li>
                <Link
                  href="/for-photographers/pricing"
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block"
                >
                  {t("pricingPlans")}
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block"
                >
                  {t("howItWorks")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("company")}</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("blog")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("faq")}
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("helpCenter")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-500 transition hover:text-primary-600 py-1 inline-block">
                  {t("termsOfService")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-warm-200 pt-6">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <a href="mailto:info@photoportugal.com" className="hover:text-primary-600 transition">info@photoportugal.com</a>
            <span className="text-gray-300">&middot;</span>
            <a href="tel:+351308800496" className="hover:text-primary-600 transition">+351 308 800 496</a>
          </div>
          <p className="mt-2 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} {t("copyright")}
          </p>
          <p className="mt-1 text-center text-xs text-gray-300">
            {t("legalEntity")} &middot; {t("legalEntityType")} &middot; {t("legalEntityNif")} &middot; {t("legalEntityLocation")}
          </p>
          <p className="mt-0.5 text-center text-[10px] text-gray-400">
            {t("legalEntityVat")}
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
