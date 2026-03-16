import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">
          Welcome, {session.user.name}
        </h1>
        <p className="mt-1 text-gray-500">
          Manage your bookings and find your perfect photographer
        </p>
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/photographers"
          className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">Find a Photographer</h3>
          <p className="mt-1 text-sm text-gray-500">
            Browse portfolios and book your perfect photoshoot
          </p>
        </Link>

        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100 text-warm-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">My Bookings</h3>
          <p className="mt-1 text-sm text-gray-500">
            No bookings yet. Find a photographer to get started!
          </p>
        </div>

        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100 text-warm-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="mt-4 font-bold text-gray-900">My Reviews</h3>
          <p className="mt-1 text-sm text-gray-500">
            Reviews you&apos;ve left for photographers
          </p>
        </div>
      </div>

      {/* Saved photographers */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white p-8 text-center">
          <p className="text-gray-400">
            No activity yet. Start by{" "}
            <Link href="/photographers" className="text-primary-600 hover:underline">
              browsing photographers
            </Link>
            !
          </p>
        </div>
      </div>
    </div>
  );
}
