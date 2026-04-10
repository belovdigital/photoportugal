"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useConfirmModal } from "@/components/ui/ConfirmModal";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Invalid credentials");
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-gray-900">Admin</h1>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminLogoutButton() {
  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
    >
      Log Out
    </button>
  );
}

export function AdminToggleClient({ id, field, value, name }: { id: string; field: string; value: boolean; name?: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(value);
  const [loading, setLoading] = useState(false);
  const { modal, confirm } = useConfirmModal();

  const fieldLabel = field === "is_approved" ? "Approved" : field === "is_verified" ? "Verified" : field === "is_featured" ? "Featured" : field;

  async function toggle() {
    const newValue = !checked;
    const action = newValue ? "enable" : "disable";
    const target = name ? ` for ${name}` : "";
    const ok = await confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${fieldLabel}`,
      `${action.charAt(0).toUpperCase() + action.slice(1)} "${fieldLabel}"${target}?`,
      { confirmLabel: newValue ? "Enable" : "Disable" }
    );
    if (!ok) return;

    setLoading(true);
    const res = await fetch("/api/admin/photographer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: newValue }),
    });
    setLoading(false);
    if (res.ok) {
      setChecked(newValue);
      router.refresh();
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: `${fieldLabel} ${newValue ? "enabled" : "disabled"}${target}`, type: "success" } }));
    } else {
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: `Failed to update ${fieldLabel}`, type: "error" } }));
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-accent-500" : "bg-gray-200"
        } ${loading ? "opacity-50" : ""}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      {modal}
    </>
  );
}

export function AdminDeactivatePhotographer({ id, name, isActive, label }: { id: string; name: string; isActive: boolean; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(isActive);
  const { modal, confirm } = useConfirmModal();

  async function handleToggle() {
    const action = active ? "deactivate" : "reactivate";
    if (active) {
      const ok = await confirm(
        `Deactivate ${name}`,
        `Deactivate photographer "${name}"? They won't be able to log in and their profile will be hidden.`,
        { danger: true, confirmLabel: "Deactivate" }
      );
      if (!ok) return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/photographer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_approved: !active, is_deactivated: active }),
    });
    setLoading(false);
    if (res.ok) {
      setActive(!active);
      router.refresh();
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: `Photographer ${action}d`, type: "success" } }));
    } else {
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: `Failed to ${action}`, type: "error" } }));
    }
  }

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`rounded px-2 py-1 text-xs font-medium ${active ? "text-red-500 hover:bg-red-50" : "text-accent-600 hover:bg-accent-50"} disabled:opacity-50`}
      >
        {loading ? "..." : label ? label : active ? "Deactivate" : "Reactivate"}
      </button>
      {modal}
    </>
  );
}

export function AdminNotificationEmail({ initialValue }: { initialValue: string }) {
  const [emails, setEmails] = useState<string[]>(() =>
    initialValue ? initialValue.split(",").map((e) => e.trim()).filter(Boolean) : []
  );
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addEmail() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    if (emails.includes(trimmed)) { setInput(""); return; }
    setEmails([...emails, trimmed]);
    setInput("");
  }

  function removeEmail(email: string) {
    setEmails(emails.filter((e) => e !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
    if (e.key === "Backspace" && !input && emails.length > 0) {
      setEmails(emails.slice(0, -1));
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_notification_email", value: emails.join(", ") }),
      });
      if (res.ok) {
        setMessage("Saved!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1 text-sm text-primary-700"
          >
            {email}
            <button
              onClick={() => removeEmail(email)}
              className="text-primary-400 transition hover:text-red-500"
              aria-label={`Remove ${email}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addEmail}
          placeholder={emails.length === 0 ? "Type email and press Enter" : "Add another..."}
          className="min-w-[180px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        {message && <span className="text-sm text-green-600">{message}</span>}
      </div>
    </div>
  );
}

export function AdminNotificationPhone({ initialValue }: { initialValue: string }) {
  const [phones, setPhones] = useState<string[]>(() =>
    initialValue ? initialValue.split(",").map((p) => p.trim()).filter(Boolean) : []
  );
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addPhone() {
    const trimmed = input.trim();
    if (!trimmed || !/^\+?[\d\s()-]{7,20}$/.test(trimmed)) return;
    const normalized = trimmed.replace(/[\s()-]/g, "");
    if (phones.includes(normalized)) { setInput(""); return; }
    setPhones([...phones, normalized]);
    setInput("");
  }

  function removePhone(phone: string) {
    setPhones(phones.filter((p) => p !== phone));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPhone();
    }
    if (e.key === "Backspace" && !input && phones.length > 0) {
      setPhones(phones.slice(0, -1));
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_notification_phone", value: phones.join(", ") }),
      });
      if (res.ok) {
        setMessage("Saved!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
        {phones.map((phone) => (
          <span key={phone} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-700">
            {phone}
            <button onClick={() => removePhone(phone)} className="text-blue-400 transition hover:text-red-500" aria-label={`Remove ${phone}`}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="tel"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addPhone}
          placeholder={phones.length === 0 ? "+351... and press Enter" : "Add another..."}
          className="min-w-[180px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
          {saving ? "..." : "Save"}
        </button>
        {message && <span className="text-sm text-green-600">{message}</span>}
      </div>
    </div>
  );
}

export function AdminBanToggle({ id, value }: { id: string; value: boolean }) {
  const router = useRouter();
  const [banned, setBanned] = useState(value);
  const [loading, setLoading] = useState(false);
  const { modal, confirm } = useConfirmModal();

  async function toggle() {
    const newValue = !banned;
    if (newValue) {
      const ok = await confirm(
        "Ban User",
        "Are you sure you want to ban this user? They will not be able to log in.",
        { danger: true, confirmLabel: "Ban" }
      );
      if (!ok) return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_banned: newValue }),
    });
    setLoading(false);
    if (res.ok) {
      setBanned(newValue);
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={loading}
        className={`rounded px-2 py-1 text-xs font-medium transition ${
          banned
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        } ${loading ? "opacity-50" : ""}`}
      >
        {loading ? "..." : banned ? "Banned" : "Active"}
      </button>
      {modal}
    </>
  );
}

export function AdminPlanSelectClient({ id, currentPlan }: { id: string; currentPlan: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const { modal, confirm } = useConfirmModal();

  async function changePlan(newPlan: string) {
    const ok = await confirm("Change Plan", `Change plan to "${newPlan}"?`, { confirmLabel: "Change" });
    if (!ok) { return; }
    setLoading(true);
    const res = await fetch("/api/admin/photographer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, plan: newPlan }),
    });
    setLoading(false);
    if (res.ok) {
      setPlan(newPlan);
      router.refresh();
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: `Plan changed to ${newPlan}`, type: "success" } }));
    } else {
      window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: "Failed to change plan", type: "error" } }));
    }
  }

  return (
    <>
      <select
        value={plan}
        onChange={(e) => changePlan(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-primary-500"
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="premium">Premium</option>
      </select>
      {modal}
    </>
  );
}

export function AdminBookingActions({ id, status, paymentStatus }: { id: string; status: string; paymentStatus: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { modal, confirm } = useConfirmModal();

  async function handleAction(action: "cancel" | "delete") {
    const ok = await confirm(
      action === "cancel" ? "Cancel Booking" : "Delete Booking",
      action === "cancel" && paymentStatus === "paid"
        ? "Cancel this booking and issue a FULL REFUND? This cannot be undone."
        : action === "cancel"
        ? "Cancel this booking? This cannot be undone."
        : "Permanently DELETE this booking? This cannot be undone.",
      { danger: true, confirmLabel: action === "cancel" ? "Cancel Booking" : "Delete" }
    );
    if (!ok) return;
    setLoading(true);
    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed");
    }
  }

  if (loading) return <><span className="text-xs text-gray-400">...</span>{modal}</>;

  return (
    <>
      <div className="flex gap-1">
        {status !== "cancelled" && (
          <button
            onClick={() => handleAction("cancel")}
            className="rounded px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition"
          >
            Cancel{paymentStatus === "paid" ? " & Refund" : ""}
          </button>
        )}
        {(status === "cancelled" || paymentStatus !== "paid") && (
          <button
            onClick={() => handleAction("delete")}
            className="rounded px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
          >
            Delete
          </button>
        )}
      </div>
      {modal}
    </>
  );
}

export function AdminReviewsLink({ photographerId, count, name }: { photographerId: string; count: number; name: string }) {
  function handleClick() {
    // Switch to reviews tab and filter
    window.location.hash = "reviews";
    window.dispatchEvent(new CustomEvent("admin-filter-reviews", { detail: { photographerId: name } }));
    // Also trigger tab change
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  if (count === 0) return <span className="text-xs text-gray-400 ml-1">(0)</span>;

  return (
    <button
      onClick={handleClick}
      className="ml-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
    >
      ({count} review{count !== 1 ? "s" : ""})
    </button>
  );
}
