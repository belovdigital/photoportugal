import Link from "next/link";
import { unsplashUrl } from "@/lib/unsplash-images";

const shootTypes = [
  {
    title: "Couples",
    description: "Romantic moments in stunning settings",
    image: "photo-1529634597503-139d3726fed5", // couple photo
    slug: "couple",
  },
  {
    title: "Family",
    description: "Natural, joyful family memories",
    image: "photo-1581579438747-104c53d7fbc4", // family
    slug: "family",
  },
  {
    title: "Honeymoon",
    description: "Celebrate your love story in Portugal",
    image: "photo-1519741497674-611481863552", // honeymoon/wedding vibes
    slug: "honeymoon",
  },
  {
    title: "Solo",
    description: "Stunning portraits, zero selfie struggle",
    image: "photo-1494790108377-be9c29b29330", // solo portrait
    slug: "solo",
  },
  {
    title: "Engagement",
    description: "Say yes with Portugal as your backdrop",
    image: "photo-1522673607200-164d1b6ce486", // engagement
    slug: "engagement",
  },
  {
    title: "Friends",
    description: "Group trips deserve great photos",
    image: "photo-1529156069898-49953e39b3ac", // group of friends
    slug: "friends",
  },
];

export function ShootTypesSection() {
  return (
    <section className="border-y border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-700">
            For Everyone
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            What&apos;s Your Perfect Shoot?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            Whether it&apos;s a romantic getaway, a family trip, or a solo adventure — we have the right photographer for you
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {shootTypes.map((type) => (
            <Link
              key={type.slug}
              href={`/photographers?type=${type.slug}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-900 sm:aspect-[4/5]"
            >
              <img
                src={unsplashUrl(type.image, 400)}
                alt={`${type.title} photoshoot in Portugal`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                  {type.title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-300 sm:text-sm">
                  {type.description}
                </p>
              </div>

              {/* Hover arrow */}
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/0 transition group-hover:bg-white/20">
                <svg className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
