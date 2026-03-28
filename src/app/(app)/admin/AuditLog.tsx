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
}

const ACTION_COLORS: Record<string, string> = {
  update: "bg-blue-100 text-blue-700",
  create: "bg-green-100 text-green-700",
  delete: "bg-red-100 text-red-700",
  approve: "bg-green-100 text-green-700",
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading audit log...</p>;

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">No audit entries yet. Actions will be logged here automatically.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const date = new Date(e.created_at);
        const timeAgo = getTimeAgo(date);

        return (
          <div key={e.id} className="flex items-start gap-3 rounded-lg border border-warm-100 bg-white px-3 py-2.5">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[e.action] || "bg-gray-100 text-gray-600"}`}>
              {e.action}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{e.entity_type}</span>
                {e.entity_name && <span className="text-gray-500"> &middot; {e.entity_name}</span>}
              </p>
              {e.details && <p className="text-xs text-gray-400 mt-0.5">{e.details}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-gray-400">{timeAgo}</p>
              <p className="text-[10px] text-gray-300">{e.admin_email}</p>
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
