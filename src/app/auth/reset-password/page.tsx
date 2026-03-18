"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-600">
          Invalid reset link. Please request a new password reset.
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-4 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          Request Reset Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm text-gray-700">
          Your password has been reset successfully.
        </p>
        <Link
          href="/auth/signin"
          className="mt-4 inline-block rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            placeholder="Re-enter your password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Set New Password
          </h1>
          <p className="mt-2 text-gray-500">
            Enter your new password below
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
