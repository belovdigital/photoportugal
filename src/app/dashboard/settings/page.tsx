"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
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

function AvatarUpload({ initialUrl, fallbackChar, onMessage }: { initialUrl: string | null; fallbackChar: string; onMessage: (msg: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onMessage("File too large (max 5MB)"); return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage("Only images allowed"); return; }
    setPreviewUrl(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    onMessage("Uploading photo...");
    try {
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage("Photo updated!");
      } else {
        setPreviewUrl(initialUrl);
        onMessage("Upload failed");
      }
    } catch {
      setPreviewUrl(initialUrl);
      onMessage("Upload failed");
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden">
          {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : fallbackChar}
        </div>
        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          {uploading ? "Uploading..." : "Upload Photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
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
  const [smsBookings, setSmsBookings] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Load preferences from DB
  useEffect(() => {
    fetch("/api/dashboard/notifications")
      .then((r) => r.json())
      .then((data) => {
        setEmailBookings(data.email_bookings ?? true);
        setEmailMessages(data.email_messages ?? true);
        setEmailReviews(data.email_reviews ?? true);
        setSmsBookings(data.sms_bookings ?? true);
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
    const prefs = { email_bookings: emailBookings, email_messages: emailMessages, email_reviews: emailReviews, sms_bookings: smsBookings, [key]: value };
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
          {!isPhotographer && (
            <AvatarUpload
              initialUrl={(user as { image?: string | null })?.image || null}
              fallbackChar={user.name?.charAt(0) || "U"}
              onMessage={showMessage}
            />
          )}
          {!isPhotographer && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={user.email || ""} disabled
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
          </div>
          {!isPhotographer && (
            <button type="submit" disabled={saving}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
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

      {/* SMS Notifications */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">SMS Notifications</h2>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white divide-y divide-warm-100">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-gray-900">New bookings</p>
                <p className="text-xs text-gray-400">Receive an SMS when someone requests a session</p>
              </div>
              {prefsLoaded && <Toggle enabled={smsBookings} onChange={(v) => { setSmsBookings(v); saveNotificationPref("sms_bookings", v); }} />}
            </div>
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-bold text-red-600">Danger Zone</h2>
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-6">
          {!showDeleteDialog ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete Account</p>
                <p className="text-xs text-gray-500">Permanently delete your account and all data.</p>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Delete Account
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-900">Are you sure?</p>
              <p className="mt-1 text-xs text-gray-500">
                This will permanently delete your account, all bookings, messages, reviews, and any other data.
                This action cannot be undone.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => { setDeleteConfirmation(e.target.value); setDeleteError(""); }}
                  placeholder="DELETE"
                  className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  disabled={deleting}
                />
              </div>
              {deleteError && (
                <p className="mt-2 text-sm text-red-600">{deleteError}</p>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (deleteConfirmation !== "DELETE") {
                      setDeleteError("Please type DELETE to confirm.");
                      return;
                    }
                    setDeleting(true);
                    setDeleteError("");
                    try {
                      const res = await fetch("/api/dashboard/account", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ confirmation: "DELETE" }),
                      });
                      if (res.ok) {
                        signOut({ callbackUrl: "/" });
                      } else {
                        const data = await res.json();
                        setDeleteError(data.error || "Failed to delete account. Please try again.");
                        setDeleting(false);
                      }
                    } catch {
                      setDeleteError("Failed to delete account. Please try again.");
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting || deleteConfirmation !== "DELETE"}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Permanently Delete Account"}
                </button>
                <button
                  onClick={() => { setShowDeleteDialog(false); setDeleteConfirmation(""); setDeleteError(""); }}
                  disabled={deleting}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
