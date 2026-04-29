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
    <section className="app-cta-banner border-t border-warm-200 bg-warm-50">
      <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
        <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("appTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
          {t("appSubtitle")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://apps.apple.com/app/photo-portugal/id6761375811"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80"
          >
            <img
              src="/badges/app-store.svg"
              alt={t("appStoreAlt")}
              width={120}
              height={40}
              className="h-[40px]"
            />
          </a>
          <div className="relative">
            <img
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt={t("googlePlayAlt")}
              width={155}
              height={58}
              className="h-[58px] opacity-30 grayscale"
            />
            <span className="absolute top-0 -right-1.5 rounded-full bg-primary-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase leading-none">{t("soon")}</span>
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
                    className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block"
                  >
                    {t("photographersIn", { location: loc.name })}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/locations"
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700 py-2 inline-block"
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
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block"
                >
                  {t("joinAsPhotographer")}
                </Link>
              </li>
              <li>
                <Link
                  href="/for-photographers/pricing"
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block"
                >
                  {t("pricingPlans")}
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block"
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
                <Link href="/about" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("blog")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("faq")}
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("helpCenter")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-500 transition hover:text-primary-600 py-2 inline-block">
                  {t("termsOfService")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-warm-200 pt-6">
          <div className="flex items-center justify-center gap-4">
            <a href="https://www.instagram.com/photoportugal_com" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-100 text-gray-500 transition hover:bg-primary-100 hover:text-primary-600" aria-label="Instagram">
              <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.facebook.com/photoportugalofficial" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-100 text-gray-500 transition hover:bg-primary-100 hover:text-primary-600" aria-label="Facebook">
              <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.linkedin.com/company/photoportugal" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-100 text-gray-500 transition hover:bg-primary-100 hover:text-primary-600" aria-label="LinkedIn">
              <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@photoportugal" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-100 text-gray-500 transition hover:bg-primary-100 hover:text-primary-600" aria-label="TikTok">
              <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/></svg>
            </a>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-gray-400">
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
          <p className="mt-0.5 text-center text-xs text-gray-400">
            {t("legalEntityVat")}
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
