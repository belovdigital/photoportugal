"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
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

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // TODO: implement account update API
    setTimeout(() => {
      setSaving(false);
      showMessage("Settings saved!");
    }, 500);
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-gray-500">Manage your account and preferences</p>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
          {message}
        </div>
      )}

      {/* Account */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Account</h2>
        <form onSubmit={saveAccount} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <p className="mt-1 text-sm text-gray-600 capitalize">{role || "client"}</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Notifications */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Email Notifications</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">New bookings</p>
              <p className="text-xs text-gray-400">Get notified when someone books you</p>
            </div>
            <input
              type="checkbox"
              checked={emailBookings}
              onChange={(e) => setEmailBookings(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary-600"
            />
          </label>
          <hr className="border-warm-100" />
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">New messages</p>
              <p className="text-xs text-gray-400">Get notified when you receive a message</p>
            </div>
            <input
              type="checkbox"
              checked={emailMessages}
              onChange={(e) => setEmailMessages(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary-600"
            />
          </label>
          <hr className="border-warm-100" />
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">New reviews</p>
              <p className="text-xs text-gray-400">Get notified when a client leaves a review</p>
            </div>
            <input
              type="checkbox"
              checked={emailReviews}
              onChange={(e) => setEmailReviews(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary-600"
            />
          </label>
        </div>
      </section>

      {/* Subscription */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">Subscription & Billing</h2>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">Current Plan</p>
                  <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-bold text-primary-600 uppercase">
                    Free
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  10 portfolio photos, 1 location, basic visibility
                </p>
              </div>
              <Link
                href="/pricing"
                className="rounded-xl border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                View Plans
              </Link>
            </div>
            <div className="mt-4 rounded-lg bg-warm-50 p-4">
              <p className="text-sm text-gray-600">
                Pro and Premium plans are coming soon. Want early access?{" "}
                <a href="mailto:info@photoportugal.com" className="font-semibold text-primary-600 hover:underline">
                  Contact us
                </a>
              </p>
            </div>
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
              <p className="text-xs text-gray-500">
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
                  // TODO: implement account deletion
                  alert("Please contact info@photoportugal.com to delete your account.");
                }
              }}
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
