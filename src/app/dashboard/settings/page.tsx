"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        enabled ? "bg-primary-600" : "bg-gray-200"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string })?.role;
  const isPhotographer = role === "photographer";

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Notification preferences
  const [emailBookings, setEmailBookings] = useState(true);
  const [emailMessages, setEmailMessages] = useState(true);
  const [emailReviews, setEmailReviews] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences from DB
  useEffect(() => {
    fetch("/api/dashboard/notifications")
      .then((r) => r.json())
      .then((data) => {
        setEmailBookings(data.email_bookings ?? true);
        setEmailMessages(data.email_messages ?? true);
        setEmailReviews(data.email_reviews ?? true);
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, []);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) showMessage("Settings saved!");
      else showMessage("Failed to save");
    } catch { showMessage("Failed to save"); }
    setSaving(false);
  }

  async function saveNotificationPref(key: string, value: boolean) {
    const prefs = { email_bookings: emailBookings, email_messages: emailMessages, email_reviews: emailReviews, [key]: value };
    try {
      await fetch("/api/dashboard/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch {}
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-gray-500">Manage your account and preferences</p>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">{message}</div>
      )}

      {/* Account */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Account</h2>
        <form onSubmit={saveAccount} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={user.email || ""} disabled
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
          </div>
          <button type="submit" disabled={saving}
            className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Notifications */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Email Notifications</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white divide-y divide-warm-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">New bookings</p>
              <p className="text-xs text-gray-400">Get notified when someone requests a session</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailBookings} onChange={(v) => { setEmailBookings(v); saveNotificationPref("email_bookings", v); }} />}
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">New messages</p>
              <p className="text-xs text-gray-400">Get notified when you receive a message</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailMessages} onChange={(v) => { setEmailMessages(v); saveNotificationPref("email_messages", v); }} />}
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">New reviews</p>
              <p className="text-xs text-gray-400">Get notified when a client leaves a review</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailReviews} onChange={(v) => { setEmailReviews(v); saveNotificationPref("email_reviews", v); }} />}
          </div>
        </div>
      </section>

      {/* Subscription */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">Subscription & Billing</h2>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6">
            <p className="text-sm text-gray-600">Manage your plan and payment details.</p>
            <Link href="/dashboard/subscription" className="mt-3 inline-flex rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              Manage Subscription
            </Link>
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-bold text-red-600">Danger Zone</h2>
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete Account</p>
              <p className="text-xs text-gray-500">Permanently delete your account and all data.</p>
            </div>
            <button
              onClick={() => { if (confirm("Are you sure? This cannot be undone.")) alert("Please contact info@photoportugal.com to delete your account."); }}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
