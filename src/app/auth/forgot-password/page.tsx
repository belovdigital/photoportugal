"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        setError("Too many requests. Please try again later.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Reset Password
          </h1>
          <p className="mt-2 text-gray-500">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-gray-700">
                If an account exists with that email, we&apos;ve sent a reset link.
                Please check your inbox and spam folder.
              </p>
              <Link
                href="/auth/signin"
                className="mt-6 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>

        {!submitted && (
          <p className="mt-6 text-center text-sm text-gray-500">
            Remember your password?{" "}
            <Link href="/auth/signin" className="font-semibold text-primary-600 hover:text-primary-700">
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
