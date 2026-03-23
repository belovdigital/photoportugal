"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

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
  function handleLogout() {
    document.cookie = "admin_token=; path=/; max-age=0";
    signOut({ callbackUrl: "/" });
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

export function AdminToggleClient({ id, field, value }: { id: string; field: string; value: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(value);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const newValue = !checked;
    const res = await fetch("/api/admin/photographer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: newValue }),
    });
    setLoading(false);
    if (res.ok) {
      setChecked(newValue);
      router.refresh();
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-accent-500" : "bg-gray-200"
      } ${loading ? "opacity-50" : ""}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function AdminDeactivatePhotographer({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(isActive);

  async function handleToggle() {
    const action = active ? "deactivate" : "reactivate";
    if (active && !confirm(`Deactivate photographer "${name}"? They won't be able to log in and their profile will be hidden.`)) return;
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
    } else {
      alert(`Failed to ${action}`);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded px-2 py-1 text-xs font-medium ${active ? "text-red-500 hover:bg-red-50" : "text-accent-600 hover:bg-accent-50"} disabled:opacity-50`}
    >
      {loading ? "..." : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}

export function AdminNotificationEmail({ initialValue }: { initialValue: string }) {
  const [email, setEmail] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_notification_email", value: email.trim() }),
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
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@photoportugal.com, backup@gmail.com"
        className="block w-full max-w-sm rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      {message && <span className="text-sm text-green-600">{message}</span>}
    </div>
  );
}

export function AdminBanToggle({ id, value }: { id: string; value: boolean }) {
  const router = useRouter();
  const [banned, setBanned] = useState(value);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const newValue = !banned;
    if (newValue && !confirm("Are you sure you want to ban this user? They will not be able to log in.")) return;
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
  );
}

export function AdminPlanSelectClient({ id, currentPlan }: { id: string; currentPlan: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);

  async function changePlan(newPlan: string) {
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
    }
  }

  return (
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
  );
}

export function AdminBookingActions({ id, status, paymentStatus }: { id: string; status: string; paymentStatus: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "cancel" | "delete") {
    const messages = {
      cancel: paymentStatus === "paid"
        ? `Cancel this booking and issue a FULL REFUND? This cannot be undone.`
        : `Cancel this booking? This cannot be undone.`,
      delete: `Permanently DELETE this booking? This cannot be undone.`,
    };
    if (!confirm(messages[action])) return;

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

  if (loading) return <span className="text-xs text-gray-400">...</span>;

  return (
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
