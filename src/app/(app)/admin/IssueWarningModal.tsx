"use client";

import { useEffect, useMemo, useState } from "react";

const CATEGORIES = [
  { value: "no-show", label: "No-show — didn't turn up to shoot" },
  { value: "late-delivery", label: "Late delivery — past photo deadline" },
  { value: "unresponsive", label: "Unresponsive — ghosting / slow replies" },
  { value: "quality", label: "Quality complaint" },
  { value: "billing", label: "Billing dispute" },
  { value: "conduct", label: "Conduct — rude / inappropriate" },
  { value: "policy", label: "Policy violation" },
  { value: "safety", label: "Safety / harassment" },
  { value: "misrepresentation", label: "Misrepresentation (style vs portfolio)" },
  { value: "availability-conflict", label: "Availability conflict — unavailable after booking request" },
  { value: "other", label: "Other (describe below)" },
];

const SEVERITY_STYLES: Record<string, { ring: string; bg: string; text: string; label: string; desc: string }> = {
  info: { ring: "ring-sky-300", bg: "bg-sky-50", text: "text-sky-700", label: "Info", desc: "Logged only; tracking pattern." },
  minor: { ring: "ring-yellow-300", bg: "bg-yellow-50", text: "text-yellow-700", label: "Minor", desc: "Soft warning, internal." },
  major: { ring: "ring-orange-300", bg: "bg-orange-50", text: "text-orange-700", label: "Major", desc: "Formal warning, may affect ranking." },
  critical: { ring: "ring-red-300", bg: "bg-red-50", text: "text-red-700", label: "Critical", desc: "Severe — deactivation candidate." },
};

export interface PhotographerOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface BookingOption {
  id: string;
  shoot_date: string | null;
  client_name: string;
}

export function IssueWarningModal({
  photographers,
  defaultPhotographerId,
  defaultBookingId,
  onClose,
  onIssued,
}: {
  photographers: PhotographerOption[];
  defaultPhotographerId?: string;
  defaultBookingId?: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [photographerId, setPhotographerId] = useState<string>(defaultPhotographerId || "");
  const [photographerQuery, setPhotographerQuery] = useState("");
  const [showPhotographerList, setShowPhotographerList] = useState(false);
  const [category, setCategory] = useState<string>("unresponsive");
  const [severity, setSeverity] = useState<string>("minor");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [relatedBookings, setRelatedBookings] = useState<BookingOption[]>([]);
  const [relatedBookingId, setRelatedBookingId] = useState<string>(defaultBookingId || "");
  const [reporterEmail, setReporterEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Esc + body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Load recent bookings for the chosen photographer (optional linkage).
  useEffect(() => {
    if (!photographerId) {
      setRelatedBookings([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/warnings/bookings?photographer_id=${photographerId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRelatedBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      })
      .catch(() => {
        if (!cancelled) setRelatedBookings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [photographerId]);

  const selectedPhotographer = useMemo(
    () => photographers.find((p) => p.id === photographerId) || null,
    [photographerId, photographers]
  );

  const filteredPhotographers = useMemo(() => {
    const q = photographerQuery.trim().toLowerCase();
    if (!q) return photographers.slice(0, 20);
    return photographers
      .filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      .slice(0, 20);
  }, [photographers, photographerQuery]);

  const validForm =
    !!photographerId &&
    !!category &&
    !!severity &&
    title.trim().length >= 3 &&
    comment.trim().length >= 5 &&
    /^\d{4}-\d{2}-\d{2}$/.test(incidentDate);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validForm) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photographer_id: photographerId,
          category,
          severity,
          title: title.trim(),
          comment: comment.trim(),
          incident_date: incidentDate,
          related_booking_id: relatedBookingId || null,
          reporter_email: reporterEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Failed to issue warning");
        setSubmitting(false);
        return;
      }
      onIssued();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-start justify-center px-4 py-8 pointer-events-none overflow-y-auto">
        <div
          className="pointer-events-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Issue warning"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-warm-200 bg-white px-5 py-3 rounded-t-2xl">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Internal admin record
              </p>
              <h2 className="text-lg font-bold text-gray-900">Issue a photographer warning</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            {/* Photographer typeahead */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                Photographer
              </label>
              {selectedPhotographer ? (
                <div className="flex items-center justify-between rounded-lg border border-warm-200 bg-warm-50/50 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{selectedPhotographer.name}</span>{" "}
                    <span className="text-gray-500">· {selectedPhotographer.slug} · {selectedPhotographer.plan}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotographerId("");
                      setPhotographerQuery("");
                      setShowPhotographerList(true);
                    }}
                    className="text-xs font-semibold text-primary-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type a name or slug…"
                    value={photographerQuery}
                    onChange={(e) => {
                      setPhotographerQuery(e.target.value);
                      setShowPhotographerList(true);
                    }}
                    onFocus={() => setShowPhotographerList(true)}
                    className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                  />
                  {showPhotographerList && filteredPhotographers.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-warm-200 bg-white shadow-lg">
                      {filteredPhotographers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPhotographerId(p.id);
                            setShowPhotographerList(false);
                            setPhotographerQuery("");
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-warm-50"
                        >
                          <span className="font-semibold text-gray-900">{p.name}</span>{" "}
                          <span className="text-gray-500">· {p.slug} · {p.plan}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                  Incident date
                </label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                Severity
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["info", "minor", "major", "critical"] as const).map((s) => {
                  const sty = SEVERITY_STYLES[s];
                  const active = severity === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                        active
                          ? `${sty.bg} ${sty.text} ring-2 ${sty.ring}`
                          : "bg-white text-gray-500 ring-1 ring-warm-200 hover:bg-warm-50"
                      }`}
                    >
                      {sty.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{SEVERITY_STYLES[severity]?.desc}</p>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                Title (one-line summary)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Missed shoot in Algarve, no notice"'
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                Comment / context
              </label>
              <textarea
                required
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What happened, who reported it, what was the impact. Reference bookings by ID."
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                maxLength={4000}
              />
              <p className="mt-1 text-[11px] text-gray-400">{comment.length}/4000</p>
            </div>

            {relatedBookings.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                  Linked booking (optional)
                </label>
                <select
                  value={relatedBookingId}
                  onChange={(e) => setRelatedBookingId(e.target.value)}
                  className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— No linked booking —</option>
                  {relatedBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id.slice(0, 8)} · {b.shoot_date || "no date"} · {b.client_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                Reporter email (optional)
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="Client email if a complaint triggered this"
                className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-warm-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!validForm || submitting}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? "Issuing…" : "Issue warning"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
