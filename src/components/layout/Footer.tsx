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
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:justify-between gap-8">
          <div className="max-w-lg">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("appTitle")}
            </h2>
            <p className="mt-3 text-gray-500">
              {t("appSubtitle")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end shrink-0">
            <a
              href="https://apps.apple.com/app/photo-portugal/id6761375811"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:opacity-80"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-12"
              />
            </a>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 opacity-60">
              <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 2.267l-5.39 9.328h10.819L17.523 2.267zm-11.046 0L1.048 11.595h10.819L6.477 2.267zM1.048 12.405L6.477 21.733 11.867 12.405H1.048zm11.085 0L17.523 21.733l5.429-9.328H12.133z"/></svg>
              <span className="text-sm font-medium text-gray-400">Google Play</span>
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Coming Soon</span>
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
