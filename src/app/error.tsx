"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold text-gray-900">500</h1>
        <p className="mt-4 text-lg text-gray-500">Something went wrong. Please try again.</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
