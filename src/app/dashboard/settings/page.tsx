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

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
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
        <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6">
          <p className="text-sm text-gray-600">
            You&apos;ll receive email notifications for new bookings, messages, and reviews.
            Notification preferences customization is coming soon.
          </p>
        </div>
      </section>

      {/* Subscription */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">Subscription & Billing</h2>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6">
            <p className="text-sm text-gray-600">
              Manage your subscription plan and billing details.
            </p>
            <Link
              href="/dashboard/subscription"
              className="mt-3 inline-flex rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
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
