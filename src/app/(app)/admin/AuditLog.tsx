"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  admin_email: string;
  created_at: string;
  resolved_name?: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  update: { label: "Updated", color: "bg-blue-100 text-blue-700" },
  create: { label: "Created", color: "bg-green-100 text-green-700" },
  delete: { label: "Deleted", color: "bg-red-100 text-red-700" },
  approve: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
};

const DETAIL_LABELS: Record<string, string> = {
  "is_approved=true": "Approved profile",
  "is_approved=false": "Revoked approval",
  "is_verified=true": "Verified",
  "is_verified=false": "Unverified",
  "is_featured=true": "Set as featured",
  "is_featured=false": "Removed from featured",
  "is_deactivated=true": "Deactivated",
  "is_deactivated=false": "Reactivated",
  "plan=free": "Changed plan to Free",
  "plan=pro": "Changed plan to Pro",
  "plan=premium": "Changed plan to Premium",
};

const ENTITY_LABELS: Record<string, string> = {
  photographer: "Photographer",
  booking: "Booking",
  client: "Client",
  blog: "Blog Post",
  promo: "Promo Code",
  review: "Review",
  location: "Location",
};

function formatDetails(details: string | null): string {
  if (!details) return "";
  return DETAIL_LABELS[details] || details.split(",").map(d => DETAIL_LABELS[d.trim()] || d.trim()).join(", ");
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then(async (data) => {
        if (!Array.isArray(data)) { setLoading(false); return; }

        // Resolve photographer names from slugs
        const photographerIds = [...new Set(
          data.filter((e: AuditEntry) => e.entity_type === "photographer" && e.entity_id).map((e: AuditEntry) => e.entity_id)
        )];

        let nameMap: Record<string, string> = {};
        if (photographerIds.length > 0) {
          try {
            const res = await fetch(`/api/admin/photographer-names?ids=${photographerIds.join(",")}`);
            if (res.ok) nameMap = await res.json();
          } catch {}
        }

        setEntries(data.map((e: AuditEntry) => ({
          ...e,
          resolved_name: (e.entity_type === "photographer" && e.entity_id ? nameMap[e.entity_id] || e.entity_name : e.entity_name) || undefined,
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No system log entries yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const { label, color } = ACTION_LABELS[e.action] || { label: e.action, color: "bg-gray-100 text-gray-600" };
        const details = formatDetails(e.details);
        const name = e.resolved_name || e.entity_name;

        return (
          <div key={e.id} className="flex items-start gap-3 rounded-lg border border-warm-100 bg-white px-3 py-2.5">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
              {label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{ENTITY_LABELS[e.entity_type] || e.entity_type}</span>
                {name && <span className="text-gray-900 font-semibold"> {name}</span>}
              </p>
              {details && <p className="text-xs text-gray-500 mt-0.5">{details}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-gray-400">{getTimeAgo(new Date(e.created_at))}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
