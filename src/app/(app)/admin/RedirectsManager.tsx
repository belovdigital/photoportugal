"use client";

import { useEffect, useState } from "react";

type Redirect = {
  id: string;
  source_host: string;
  source_path: string;
  target_url: string;
  status_code: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<number, string> = {
  301: "301 — permanent",
  302: "302 — temporary",
  307: "307 — temporary (preserves method)",
  308: "308 — permanent (preserves method)",
};

type FormState = {
  id: string | null;
  source_host: string;
  source_path: string;
  target_url: string;
  status_code: number;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  source_host: "lens.pt",
  source_path: "/",
  target_url: "",
  status_code: 301,
  notes: "",
};

export function RedirectsManager() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/redirects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRedirects(data.redirects || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(r: Redirect) {
    setForm({
      id: r.id,
      source_host: r.source_host,
      source_path: r.source_path,
      target_url: r.target_url,
      status_code: r.status_code,
      notes: r.notes || "",
    });
    setShowForm(true);
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      source_host: form.source_host,
      source_path: form.source_path,
      target_url: form.target_url,
      status_code: form.status_code,
      notes: form.notes.trim() || null,
    };
    try {
      const res = form.id
        ? await fetch(`/api/admin/redirects/${form.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/redirects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this redirect?")) return;
    try {
      const res = await fetch(`/api/admin/redirects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Delete failed");
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const filtered = filter
    ? redirects.filter((r) => {
        const q = filter.toLowerCase();
        return (
          r.source_host.toLowerCase().includes(q) ||
          r.source_path.toLowerCase().includes(q) ||
          r.target_url.toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        );
      })
    : redirects;

  // Group by source host for easier scanning
  const byHost = filtered.reduce<Record<string, Redirect[]>>((acc, r) => {
    (acc[r.source_host] ||= []).push(r);
    return acc;
  }, {});
  const hosts = Object.keys(byHost).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Redirects</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Source host + path → target URL. Works within a domain or across domains.
          </p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + New redirect
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={save} className="rounded-xl border border-warm-200 bg-warm-50 p-4 space-y-3">
          {/* Source: host + path read as a single URL, so render them as one
              compound control. Looks like "lens.pt / /porto" — quick to scan. */}
          <div>
            <span className="text-xs font-semibold text-gray-700">Source</span>
            <div className="mt-1 flex flex-wrap items-stretch gap-2">
              <div className="inline-flex shrink-0 rounded-lg border border-warm-200 bg-white p-0.5">
                {(["lens.pt", "photoportugal.com"] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setForm({ ...form, source_host: h })}
                    className={`rounded-md px-3 text-sm font-medium transition ${
                      form.source_host === h
                        ? "bg-primary-600 text-white"
                        : "text-gray-600 hover:bg-warm-50"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                placeholder="/porto"
                value={form.source_path}
                onChange={(e) => setForm({ ...form, source_path: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>
            <span className="mt-1 block text-[11px] text-gray-400">Exact match. No wildcards in v1.</span>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Target URL</span>
            <input
              type="text"
              required
              placeholder="https://photoportugal.com/locations/porto"
              value={form.target_url}
              onChange={(e) => setForm({ ...form, target_url: e.target.value })}
              className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-mono"
            />
            <span className="mt-1 block text-[11px] text-gray-400">
              Absolute URL (https://…) or absolute path (/foo). Inbound query string is forwarded only when target has none of its own.
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Status code</span>
              <select
                value={form.status_code}
                onChange={(e) => setForm({ ...form, status_code: parseInt(e.target.value, 10) })}
                className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
              >
                {[301, 302, 307, 308].map((c) => (
                  <option key={c} value={c}>{STATUS_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Notes (internal)</span>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                placeholder="e.g. IG bio link for Algarve campaign"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {form.id ? "Save changes" : "Create redirect"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(""); }}
              className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-warm-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by host, path, target, or notes…"
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">{redirects.length === 0 ? "No redirects yet." : "No matches."}</p>
      ) : (
        <div className="space-y-4">
          {hosts.map((host) => (
            <div key={host}>
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                {host} <span className="text-xs font-normal text-gray-400">({byHost[host].length})</span>
              </h3>
              <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-warm-50 text-left text-xs font-semibold text-gray-600">
                      <th className="px-3 py-2">Source path</th>
                      <th className="px-3 py-2">→ Target</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byHost[host].map((r) => {
                      const sourceHref = `https://${r.source_host}${r.source_path}`;
                      const targetHref = r.target_url.startsWith("/")
                        ? `https://${r.source_host}${r.target_url}`
                        : r.target_url;
                      return (
                      <tr key={r.id} className="border-t border-warm-100">
                        <td className="px-3 py-2 font-mono text-xs">
                          <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-primary-600 hover:underline">
                            {r.source_path}
                          </a>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs break-all">
                          <a href={targetHref} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-primary-600 hover:underline">
                            {r.target_url}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs">{r.status_code}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate" title={r.notes || ""}>{r.notes}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(r)}
                            className="rounded-md border border-warm-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-warm-50 mr-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(r.id)}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
