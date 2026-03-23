"use client";

import { useEffect, useState } from "react";

export default function RootError({ reset }: { reset: () => void }) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reset]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <img src="/logo.svg" alt="Photo Portugal" className="mx-auto h-8" />

        <h1 className="mt-8 font-display text-4xl font-bold text-gray-900">
          Oops, the lens cap is on!
        </h1>

        <p className="mt-4 text-base leading-relaxed text-gray-500">
          We hit a small technical hiccup. Our team is already working on it.
          The page will automatically retry in a moment.
        </p>

        <div className="mx-auto mt-8 flex items-center justify-center gap-6">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#f5f0eb" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="#c45d3e" strokeWidth="4"
                strokeDasharray={`${(countdown / 30) * 176} 176`} strokeLinecap="round"
                className="transition-all duration-1000" />
            </svg>
            <span className="text-lg font-bold text-gray-900">{countdown}s</span>
          </div>
          <button onClick={() => reset()}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
            Try Again Now
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          If this keeps happening, contact{" "}
          <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>
        </p>
      </div>
    </div>
  );
}
