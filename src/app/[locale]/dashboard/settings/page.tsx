"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { parsePhone } from "@/lib/phone-codes";
import { useTranslations } from "next-intl";
import { convertHeicIfNeeded } from "@/lib/convert-heic";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

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
  const t = useTranslations("settings");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onMessage(t("fileTooLarge")); return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage(t("onlyImagesAllowed")); return; }
    let processed = file;
    try { processed = await convertHeicIfNeeded(file); } catch { /* use original */ }
    setPreviewUrl(URL.createObjectURL(processed));
    const formData = new FormData();
    formData.append("file", processed);
    setUploading(true);
    onMessage(t("uploadingPhoto"));
    try {
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage(t("photoUpdated"));
      } else {
        const err = await res.json().catch(() => null);
        setPreviewUrl(initialUrl);
        onMessage(err?.error || t("uploadFailed"));
      }
    } catch {
      setPreviewUrl(initialUrl);
      onMessage(t("uploadFailed"));
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{t("profilePhoto")}</label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden">
          {previewUrl ? <img src={previewUrl} alt={t("profilePhotoPreview")} className="h-full w-full object-cover" /> : fallbackChar}
        </div>
        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          {uploading ? t("uploading") : t("uploadPhoto")}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations("settings");
  const user = session?.user;
  const role = (user as { role?: string })?.role;
  const isPhotographer = role === "photographer";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCode, setPhoneCode] = useState("+351");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  useEffect(() => {
    if (!nameLoaded && user?.name) {
      const parts = user.name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setNameLoaded(true);
    }
  }, [user?.name, nameLoaded]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Notification preferences
  const [emailBookings, setEmailBookings] = useState(true);
  const [emailMessages, setEmailMessages] = useState(true);
  const [emailReviews, setEmailReviews] = useState(true);
  const [smsBookings, setSmsBookings] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Telegram
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  // Photographer booking-rule settings (notice period). Loaded lazily for
  // photographers only — clients never see this section.
  const [minLeadTimeHours, setMinLeadTimeHours] = useState<number>(0);
  const [bookingSettingsLoaded, setBookingSettingsLoaded] = useState(false);
  const [savingLeadTime, setSavingLeadTime] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { modal, confirm } = useConfirmModal();

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
    // Load phone
    fetch("/api/dashboard/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.phone) {
          const parsed = parsePhone(data.phone);
          setPhoneCode(parsed.code);
          setPhoneNumber(parsed.number);
        }
      })
      .catch(() => {});
  }, []);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  // Load Telegram status (separate effect: isPhotographer depends on session loading)
  useEffect(() => {
    if (isPhotographer) {
      fetch("/api/dashboard/telegram")
        .then((r) => r.json())
        .then((data) => {
          setTelegramConnected(data.connected ?? false);
          setTelegramEnabled(data.enabled ?? false);
        })
        .catch(() => {});
    }
  }, [isPhotographer]);

  // Load booking-rule settings (photographer only).
  useEffect(() => {
    if (isPhotographer) {
      fetch("/api/dashboard/booking-settings")
        .then((r) => r.json())
        .then((data) => {
          setMinLeadTimeHours(data.minLeadTimeHours ?? 0);
          setBookingSettingsLoaded(true);
        })
        .catch(() => setBookingSettingsLoaded(true));
    }
  }, [isPhotographer]);

  async function saveLeadTime(hours: number) {
    setSavingLeadTime(true);
    setMinLeadTimeHours(hours);
    try {
      const res = await fetch("/api/dashboard/booking-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minLeadTimeHours: hours }),
      });
      if (res.ok) showMessage(t("settingsSaved"));
      else showMessage(t("failedToSave"));
    } catch {
      showMessage(t("failedToSave"));
    }
    setSavingLeadTime(false);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: phoneNumber ? `${phoneCode}${phoneNumber}` : null }),
      });
      if (res.ok) showMessage(t("settingsSaved"));
      else {
        const data = await res.json().catch(() => null);
        showMessage(data?.error || t("failedToSave"));
      }
    } catch { showMessage(t("failedToSave")); }
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

  if (sessionStatus === "loading" || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-warm-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-gray-500">{t("subtitle")}</p>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">{message}</div>
      )}

      {/* Account */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">{t("account")}</h2>
        <form onSubmit={saveAccount} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          {!isPhotographer && (
            <AvatarUpload
              initialUrl={(user as { image?: string | null })?.image || null}
              fallbackChar={user.name?.charAt(0) || "U"}
              onMessage={showMessage}
            />
          )}
          {!isPhotographer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("firstName")}</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("lastName")}</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("email")}</label>
            <input type="email" value={user.email || ""} disabled
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            <p className="mt-1 text-xs text-gray-400">{t("emailCannotBeChanged")} <a href="/dashboard/support" className="text-primary-500 hover:text-primary-600 underline">{t("contactSupport")}</a></p>
          </div>
          {!isPhotographer && (
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700">{t("phone")}</label>
              <div className="mt-1 flex gap-2">
                <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-primary-500 w-32">
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+7">🇷🇺 +7</option>
                  <option value="+27">🇿🇦 +27</option>
                  <option value="+30">🇬🇷 +30</option>
                  <option value="+31">🇳🇱 +31</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+39">🇮🇹 +39</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+43">🇦🇹 +43</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+45">🇩🇰 +45</option>
                  <option value="+46">🇸🇪 +46</option>
                  <option value="+47">🇳🇴 +47</option>
                  <option value="+48">🇵🇱 +48</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+52">🇲🇽 +52</option>
                  <option value="+55">🇧🇷 +55</option>
                  <option value="+60">🇲🇾 +60</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+64">🇳🇿 +64</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+66">🇹🇭 +66</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+82">🇰🇷 +82</option>
                  <option value="+86">🇨🇳 +86</option>
                  <option value="+90">🇹🇷 +90</option>
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+351">🇵🇹 +351</option>
                  <option value="+353">🇮🇪 +353</option>
                  <option value="+380">🇺🇦 +380</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+972">🇮🇱 +972</option>
                </select>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder=""
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
              </div>
              <p className="mt-1 text-xs text-gray-400">{t("phoneHint")}</p>
            </div>
          )}
          {!isPhotographer && (
            <button type="submit" disabled={saving}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
              {saving ? t("savingChanges") : t("saveChanges")}
            </button>
          )}
        </form>
      </section>

      {/* Email Notifications — same DB columns, role-aware labels.
          Photographers and clients both receive emails, just for different events:
            email_bookings: photographer = inquiry alerts; client = booking confirmations & status
            email_messages: same for both
            email_reviews:  photographer = "client left a review"; client = review request after a shoot
       */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">{t("emailNotifications")}</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white divide-y divide-warm-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{isPhotographer ? t("newBookings") : t("clientBookingsTitle")}</p>
              <p className="text-xs text-gray-400">{isPhotographer ? t("newBookingsDesc") : t("clientBookingsDesc")}</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailBookings} onChange={(v) => { setEmailBookings(v); saveNotificationPref("email_bookings", v); }} />}
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{t("newMessages")}</p>
              <p className="text-xs text-gray-400">{isPhotographer ? t("newMessagesDesc") : t("clientMessagesDesc")}</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailMessages} onChange={(v) => { setEmailMessages(v); saveNotificationPref("email_messages", v); }} />}
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{isPhotographer ? t("newReviews") : t("clientReviewsTitle")}</p>
              <p className="text-xs text-gray-400">{isPhotographer ? t("newReviewsDesc") : t("clientReviewsDesc")}</p>
            </div>
            {prefsLoaded && <Toggle enabled={emailReviews} onChange={(v) => { setEmailReviews(v); saveNotificationPref("email_reviews", v); }} />}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">{t("smsNotifications")}</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white divide-y divide-warm-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{isPhotographer ? t("smsNewBookings") : t("clientSmsBookingsTitle")}</p>
              <p className="text-xs text-gray-400">{isPhotographer ? t("smsNewBookingsDesc") : t("clientSmsBookingsDesc")}</p>
            </div>
            {prefsLoaded && <Toggle enabled={smsBookings} onChange={(v) => { setSmsBookings(v); saveNotificationPref("sms_bookings", v); }} />}
          </div>
        </div>
      </section>

      {/* Booking Rules — photographer only. Notice period gates how
          close to today a client can book. Default 0 = no restriction. */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">{t("bookingRules")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("bookingRulesDesc")}</p>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white px-6 py-5">
            <label htmlFor="min-lead-time" className="block text-sm font-medium text-gray-900">
              {t("minLeadTimeLabel")}
            </label>
            <p className="mt-1 text-xs text-gray-400">{t("minLeadTimeDesc")}</p>
            <select
              id="min-lead-time"
              value={minLeadTimeHours}
              onChange={(e) => saveLeadTime(parseInt(e.target.value, 10))}
              disabled={!bookingSettingsLoaded || savingLeadTime}
              className="mt-3 w-full max-w-sm rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:opacity-50"
            >
              <option value={0}>{t("minLeadTimeNone")}</option>
              <option value={12}>{t("minLeadTime12h")}</option>
              <option value={24}>{t("minLeadTime24h")}</option>
              <option value={48}>{t("minLeadTime48h")}</option>
              <option value={72}>{t("minLeadTime72h")}</option>
              <option value={120}>{t("minLeadTime5d")}</option>
              <option value={168}>{t("minLeadTime7d")}</option>
              <option value={336}>{t("minLeadTime14d")}</option>
            </select>
          </div>
        </section>
      )}

      {/* Telegram Notifications */}
      {isPhotographer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">{t("telegramNotifications")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("telegramDesc")}</p>
          <div className="mt-4 rounded-xl border border-warm-200 bg-white divide-y divide-warm-100">
            {!telegramConnected ? (
              <div className="px-6 py-5">
                <p className="text-sm text-gray-600 mb-3">{t("telegramNotConnected")}</p>
                <button
                  onClick={async () => {
                    setTelegramLoading(true);
                    try {
                      const res = await fetch("/api/dashboard/telegram", { method: "POST" });
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                        // Poll for connection status
                        const poll = setInterval(async () => {
                          try {
                            const statusRes = await fetch("/api/dashboard/telegram");
                            const statusData = await statusRes.json();
                            if (statusData.connected) {
                              setTelegramConnected(true);
                              setTelegramEnabled(statusData.enabled);
                              clearInterval(poll);
                              showMessage(t("telegramConnectedSuccess"));
                            }
                          } catch {}
                        }, 3000);
                        // Stop polling after 2 minutes
                        setTimeout(() => clearInterval(poll), 120000);
                      } else {
                        showMessage(data.error || t("failedToSave"));
                      }
                    } catch {
                      showMessage(t("failedToSave"));
                    }
                    setTelegramLoading(false);
                  }}
                  disabled={telegramLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0088cc] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#006daa] disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  {telegramLoading ? t("connecting") : t("connectTelegram")}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t("telegramActive")}</p>
                    <p className="text-xs text-gray-400">{t("telegramActiveDesc")}</p>
                  </div>
                  {prefsLoaded && (
                    <Toggle
                      enabled={telegramEnabled}
                      onChange={async (v) => {
                        setTelegramEnabled(v);
                        try {
                          await fetch("/api/dashboard/telegram", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ enabled: v }),
                          });
                        } catch {
                          setTelegramEnabled(!v);
                        }
                      }}
                    />
                  )}
                </div>
                <div className="px-6 py-3">
                  <button
                    onClick={async () => {
                      const ok = await confirm(t("telegramDisconnectTitle") || "Disconnect Telegram", t("telegramDisconnectConfirm"));
                      if (!ok) return;
                      try {
                        await fetch("/api/dashboard/telegram", { method: "DELETE" });
                        setTelegramConnected(false);
                        setTelegramEnabled(false);
                        showMessage(t("telegramDisconnected"));
                      } catch {
                        showMessage(t("failedToSave"));
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    {t("disconnectTelegram")}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-bold text-red-600">{t("dangerZone")}</h2>
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-6">
          {!showDeleteDialog ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t("deleteAccount")}</p>
                <p className="text-xs text-gray-500">{t("deleteAccountDesc")}</p>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                {t("deleteAccount")}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-900">{t("areYouSure")}</p>
              <p className="mt-1 text-xs text-gray-500">
                {t("deleteConfirmationText")}
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  {t("typeDeleteToConfirm")} <span className="font-mono font-bold text-red-600">{t("deleteKeyword")}</span> {t("toConfirm")}
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
                      setDeleteError(t("pleaseTypeDelete"));
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
                        setDeleteError(data.error || t("deleteAccountFailed"));
                        setDeleting(false);
                      }
                    } catch {
                      setDeleteError(t("deleteAccountFailed"));
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting || deleteConfirmation !== "DELETE"}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? t("deleting") : t("permanentlyDeleteAccount")}
                </button>
                <button
                  onClick={() => { setShowDeleteDialog(false); setDeleteConfirmation(""); setDeleteError(""); }}
                  disabled={deleting}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      {modal}
    </div>
  );
}
