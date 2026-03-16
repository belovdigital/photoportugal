import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-primary-600">404</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900">
          Page not found
        </h1>
        <p className="mt-4 text-gray-500">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Go Home
          </Link>
          <Link
            href="/photographers"
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Browse Photographers
          </Link>
          <Link
            href="/locations"
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Explore Locations
          </Link>
        </div>
      </div>
    </div>
  );
}
