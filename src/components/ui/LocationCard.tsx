import Link from "next/link";
import Image from "next/image";
import { Location } from "@/types";
import { locationImages } from "@/lib/unsplash-images";

export function LocationCard({ location }: { location: Location }) {
  const imageUrl = locationImages[location.slug];

  return (
    <Link
      href={`/locations/${location.slug}`}
      className="group relative overflow-hidden rounded-2xl bg-gray-900 shadow-lg transition hover:shadow-xl"
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Photography in ${location.name}, Portugal`}
            width={600}
            height={450}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-700" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {location.region}
          </span>
        </div>
        <h3 className="mt-2 font-display text-2xl font-bold text-white">
          {location.name}
        </h3>
        <p className="mt-1 text-sm text-gray-200 line-clamp-2">
          {location.description}
        </p>
      </div>
    </Link>
  );
}
