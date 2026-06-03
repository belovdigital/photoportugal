"use client";

import { useEffect, useState, useCallback } from "react";

interface NotFoundRow {
  path: string;
  hits: number;
  first_seen_at: string;
  last_seen_at: string;
  last_referrer: string | null;
  last_user_agent: string | null;
  ignored: boolean;
  suggested_target: string | null;
  suggestion: string | null;
}

export function NotFoundManager() {
  const [rows, setRows] = useState<NotFoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);
  const [minHits, setMinHits] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/not-found?show_ignored=${showIgnored}&min_hits=${minHits}`)
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [showIgnored, minHits]);

  useEffect(() => { load(); }, [load]);

  async function act(path: string, action: string, extra: Record<string, string> = {}) {
    setBusy(path + ":" + action);
    try {
      await fetch("/api/admin/not-found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, action, ...extra }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  function fmtDate(s: string) {
    const d = new Date(s);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  const totalHits = rows.reduce((s, r) => s + r.hits, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">404 Pages</h2>
          <p className="text-sm text-gray-500">
            {rows.length} path{rows.length === 1 ? "" : "s"} · {totalHits.toLocaleString()} hits total. Click <strong>Create redirect</strong> to one-shot fix.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-600 flex items-center gap-1.5">
            Min hits:
            <select
              value={minHits}
              onChange={(e) => setMinHits(parseInt(e.target.value, 10))}
              className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs"
            >
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="5">5+</option>
              <option value="10">10+</option>
              <option value="25">25+</option>
            </select>
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-1.5">
            <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} />
            Show ignored
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">Loading 404s...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400">
            No 404s logged{minHits > 1 ? ` (with ${minHits}+ hits)` : ""}. The aggregate fills up as users hit broken URLs.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2.5 text-left font-semibold">Path</th>
                <th className="px-3 py-2.5 text-right font-semibold">Hits</th>
                <th className="px-3 py-2.5 text-right font-semibold">Last seen</th>
                <th className="px-3 py-2.5 text-left font-semibold">Suggestion</th>
                <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {rows.map((r) => (
                <tr key={r.path} className={r.ignored ? "opacity-50" : ""}>
                  <td className="px-3 py-2.5">
                    <code className="text-xs font-mono text-gray-900">{r.path}</code>
                    {r.last_referrer && (
                      <p className="mt-0.5 text-[10px] text-gray-400 truncate max-w-md" title={r.last_referrer}>
                        ← {r.last_referrer}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{r.hits.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-500">{fmtDate(r.last_seen_at)}</td>
                  <td className="px-3 py-2.5">
                    {r.suggestion ? (
                      <a href={r.suggestion} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-primary-600 hover:underline">
                        {r.suggestion}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                    {r.suggested_target && (
                      <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-700">pinned</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {r.suggestion && (
                        <button
                          type="button"
                          disabled={busy === r.path + ":create_redirect"}
                          onClick={() => act(r.path, "create_redirect", { target: r.suggestion!, status_code: "301" })}
                          className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {busy === r.path + ":create_redirect" ? "..." : "Create redirect"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === r.path + ":ignore" || busy === r.path + ":unignore"}
                        onClick={() => act(r.path, r.ignored ? "unignore" : "ignore")}
                        className="rounded-lg border border-warm-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-warm-50"
                      >
                        {r.ignored ? "Unignore" : "Ignore"}
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.path + ":delete"}
                        onClick={() => { if (confirm(`Delete the 404 log for ${r.path}?`)) act(r.path, "delete"); }}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
