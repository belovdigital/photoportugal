"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
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
