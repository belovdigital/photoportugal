"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type Verified = {
  email: string;
  name: string;
  has_password: boolean;
  booking_id: string;
};

function GiftClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [verified, setVerified] = useState<Verified | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing claim token. Please use the link from your email.");
      return;
    }
    fetch(`/api/gift/claim?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setVerified(d);
      })
      .catch(() => setError("Could not load this gift. Try the link again."));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !verified) return;
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!verified.has_password && password !== passwordConfirm) { setError("Passwords don't match."); return; }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/gift/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Could not unlock your gift.");
      setSubmitting(false);
      return;
    }

    // Sign in with the email + password the recipient just confirmed.
    const result = await signIn("credentials", {
      email: data.email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Sign-in failed. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push(`/dashboard/bookings`);
  }

  if (error && !verified) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">This gift link doesn&apos;t work</h1>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <a href="/" className="text-sm text-primary-600 underline">Go to homepage</a>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading your gift…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm">
        <div className="text-5xl mb-4 text-center">🎁</div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Welcome, {verified.name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          {verified.has_password
            ? "Sign in to unlock your gift."
            : "Set a password to access your gifted photo session."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">Email</label>
            <input
              type="email"
              value={verified.email}
              readOnly
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
              {verified.has_password ? "Your password" : "Choose a password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={verified.has_password ? "current-password" : "new-password"}
              minLength={8}
              required
              autoFocus
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500"
            />
          </div>
          {!verified.has_password && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">Confirm password</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary-600 text-white py-3 font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Working…" : verified.has_password ? "Sign in & open gift" : "Set password & open gift"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-warm-50 flex items-center justify-center"><div className="text-sm text-gray-500">Loading…</div></div>}>
      <GiftClaimPage />
    </Suspense>
  );
}
