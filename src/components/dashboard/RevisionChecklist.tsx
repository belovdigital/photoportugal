"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface RevisionItem {
  id: string;
  text: string;
  admin_media_url: string | null;
  resolved: boolean;
  photographer_media_url: string | null;
  resolved_at: string | null;
}

interface Revision {
  id: string;
  status: string;
  items: RevisionItem[];
  round: number;
  admin_note: string | null;
  created_at: string;
}

export function RevisionChecklist() {
  const t = useTranslations("dashboard.revisions");
  const [revision, setRevision] = useState<Revision | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchRevision = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/revisions");
      if (res.ok) {
        const data = await res.json();
        setRevision(data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRevision(); }, [fetchRevision]);

  const resolveItem = async (itemId: string, resolved: boolean, photographerMediaUrl?: string) => {
    if (!revision) return;
    setResolving(itemId);
    try {
      const res = await fetch("/api/dashboard/revisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision_id: revision.id,
          item_id: itemId,
          resolved,
          photographer_media_url: photographerMediaUrl || undefined,
        }),
      });
      if (res.ok) {
        const { items, allResolved } = await res.json();
        setRevision(prev => prev ? { ...prev, items, status: allResolved ? "submitted" : "pending" } : null);
      }
    } catch {}
    setResolving(null);
  };

  const uploadProof = async (itemId: string, file: File) => {
    setUploading(itemId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/dashboard/revisions/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        await resolveItem(itemId, true, url);
      }
    } catch {}
    setUploading(null);
  };

  if (loading) return null;
  if (!revision) return null;

  const resolvedCount = revision.items.filter(i => i.resolved).length;
  const totalCount = revision.items.length;
  const allResolved = resolvedCount === totalCount;
  const progress = totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-r-2xl border border-amber-200 border-l-0 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 shadow-sm">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 via-orange-400 to-red-400" />

      <div className="p-6 pl-7">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-gray-900">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {revision.status === "submitted"
                ? t("submittedDescription")
                : t("description")}
            </p>
            {revision.round > 1 && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {t("round", { round: revision.round })}
              </span>
            )}
          </div>

          {/* Progress circle */}
          <div className="relative flex h-14 w-14 items-center justify-center shrink-0">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#F3EDE6" strokeWidth="3" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke={allResolved ? "#16a34a" : "#f59e0b"}
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <span className="absolute text-sm font-bold text-gray-700">
              {resolvedCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 rounded-full bg-warm-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${allResolved ? "bg-green-500" : "bg-amber-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Admin note */}
        {revision.admin_note && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">{t("adminNote")}</p>
            <p className="text-sm text-amber-800">{revision.admin_note}</p>
          </div>
        )}

        {/* Status banner for submitted */}
        {revision.status === "submitted" && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-sm font-semibold text-blue-700">{t("waitingReview")}</p>
          </div>
        )}

        {/* Items list */}
        <div className="mt-5 space-y-3">
          {revision.items.map((item, idx) => (
            <div key={item.id} className={`flex items-start gap-3 rounded-xl p-3 transition ${
              item.resolved ? "bg-green-50/50" : "bg-white border border-warm-200"
            }`}>
              {/* Checkbox */}
              <button
                onClick={() => !item.resolved && revision.status === "pending" && resolveItem(item.id, true)}
                disabled={item.resolved || resolving === item.id || revision.status === "submitted"}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                  item.resolved
                    ? "bg-green-500 text-white"
                    : resolving === item.id
                      ? "bg-amber-200 animate-pulse"
                      : "border-2 border-gray-300 hover:border-amber-400 cursor-pointer"
                }`}
              >
                {item.resolved && (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.resolved ? "line-through text-gray-400" : "text-gray-800 font-medium"}`}>
                  {item.text}
                </p>

                {/* Admin reference image */}
                {item.admin_media_url && (
                  <img
                    src={item.admin_media_url}
                    alt=""
                    className="mt-2 max-h-32 w-auto rounded-lg border object-cover cursor-pointer hover:opacity-80 transition"
                    onClick={() => window.open(item.admin_media_url!, "_blank")}
                  />
                )}

                {/* Photographer proof */}
                {item.photographer_media_url && (
                  <div className="mt-2">
                    <span className="text-[10px] font-medium text-green-600">{t("yourProof")}</span>
                    <img
                      src={item.photographer_media_url}
                      alt=""
                      className="mt-0.5 max-h-24 w-auto rounded-lg border object-cover"
                    />
                  </div>
                )}

                {/* Upload proof button — only for unresolved items */}
                {!item.resolved && revision.status === "pending" && (
                  <label className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-gray-500 cursor-pointer hover:border-primary-300 hover:text-primary-600 transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && uploadProof(item.id, e.target.files[0])}
                      disabled={uploading === item.id}
                    />
                    {uploading === item.id ? (
                      <span>{t("uploading")}</span>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{t("uploadProof")}</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
