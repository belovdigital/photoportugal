import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { unsplashUrl, IMAGE_SIZES } from "@/lib/unsplash-images";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

const SHOOT_TYPES = [
  { key: "couples", image: "photo-1529634597503-139d3726fed5", shoot: "Couples" },
  { key: "family", image: "photo-1609220136736-443140cffec6", shoot: "Family" },
  { key: "proposal", image: "photo-1515934751635-c81c6bc9a2d8", shoot: "Proposal" },
  { key: "honeymoon", image: "photo-1519741497674-611481863552", shoot: "Honeymoon" },
  { key: "elopement", image: "photo-1532712938310-34cb3982ef74", shoot: "Elopement" },
  { key: "solo", image: "photo-1494790108377-be9c29b29330", shoot: "Solo Portrait" },
  { key: "engagement", image: "photo-1522673607200-164d1b6ce486", shoot: "Engagement" },
  { key: "friends", image: "photo-1529156069898-49953e39b3ac", shoot: "Friends Trip" },
  { key: "wedding", image: "photo-1606216794079-73f85bbd57d5", shoot: "Wedding" },
] as const;

export async function ShootTypesSection() {
  const t = await getTranslations("shootTypes");

  return (
    <section className="border-y border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-700">
            {t("badge")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {SHOOT_TYPES.map((type) => (
            <Link
              key={type.shoot}
              href={`/photoshoots/${type.key}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-900 sm:aspect-[4/5]"
            >
              <OptimizedImage
                src={unsplashUrl(type.image, IMAGE_SIZES.cardLarge)}
                alt={t("altSuffix", { title: t(`types.${type.key}.title`) })}
                className="h-full w-full transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                  {t(`types.${type.key}.title`)}
                </h3>
                <p className="mt-0.5 text-xs text-gray-300 sm:text-sm">
                  {t(`types.${type.key}.description`)}
                </p>
              </div>

              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/0 transition group-hover:bg-white/20">
                <svg className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/photographers"
            className="inline-flex items-center gap-2 rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            {t("viewAllTypes")}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
