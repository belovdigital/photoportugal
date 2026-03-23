import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-primary-600">{t("code")}</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900">
          {t("title")}
        </h1>
        <p className="mt-4 text-gray-500">
          {t("description")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {t("goHome")}
          </Link>
          <Link
            href="/photographers"
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {t("browsePhotographers")}
          </Link>
          <Link
            href="/locations"
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {t("exploreLocations")}
          </Link>
        </div>
      </div>
    </div>
  );
}
