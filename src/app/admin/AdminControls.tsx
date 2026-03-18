"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  async function handleLogout() {
    document.cookie = "admin_token=; path=/; max-age=0";
    router.refresh();
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

export function AdminDeletePhotographer({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete photographer "${name}" and their entire account? This cannot be undone.`)) return;
    if (!confirm(`Are you SURE? All their bookings, messages, portfolio, and packages will be permanently deleted.`)) return;
    setLoading(true);
    const res = await fetch(`/api/admin/photographer?id=${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("Failed to delete");
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "..." : "Delete"}
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
