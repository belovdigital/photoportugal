"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ChangeDateModal } from "@/app/[locale]/dashboard/bookings/ChangeDateModal";

// Renders a DATE_PROPOSAL system chat message as a rich card with two
// actions: Accept (immediate API call) and Propose Different (opens
// the standard <ChangeDateModal>). The whole negotiation can stay in
// the chat — no need to bounce between pages.
//
// Payload format (encoded as JSON in `messages.text` after `DATE_PROPOSAL:`):
//   { proposed_date, proposed_time, proposed_by, sender_name, date_note }
//
// `viewerIsProposer` short-circuits the action buttons — if you're the
// one who sent the proposal, the card just shows a "waiting for them"
// status instead of letting you accept your own proposal.
export function DateProposalCard({
  bookingId,
  payload,
  viewerIsProposer,
  otherName,
}: {
  bookingId: string;
  payload: {
    proposed_date: string;
    proposed_time: string | null;
    proposed_by: "photographer" | "client";
    sender_name: string;
    date_note: string | null;
  };
  viewerIsProposer: boolean;
  otherName: string;
}) {
  const router = useRouter();
  const t = useTranslations("dateNegotiation");
  const locale = useLocale();
  const dateLocale = ({ pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR", en: "en-US" } as Record<string, string>)[locale] || "en-US";

  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [resolved, setResolved] = useState<"accepted" | "countered" | null>(null);

  const formattedDate = new Date(payload.proposed_date + "T12:00:00").toLocaleDateString(dateLocale, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  async function accept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/propose-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed");
        setAccepting(false);
        return;
      }
      setResolved("accepted");
      router.refresh();
    } catch {
      setError("Failed");
      setAccepting(false);
    }
  }

  return (
    <div className="my-3 flex justify-center">
      <div className="max-w-[92%] sm:max-w-[78%] rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {t("dateProposalLabel") || "Date proposal"}
          </p>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {t("proposedBy", { name: payload.sender_name }) || `${payload.sender_name} proposed:`}
        </p>
        <p className="mt-1 font-display text-lg font-bold text-gray-900 leading-tight sm:text-xl">
          {formattedDate}
          {payload.proposed_time && (
            <span className="text-gray-700"> · {payload.proposed_time}</span>
          )}
        </p>
        {payload.date_note && (
          <p className="mt-2 text-xs italic text-gray-500">&ldquo;{payload.date_note}&rdquo;</p>
        )}

        {resolved === "accepted" ? (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {t("acceptedShort") || "Accepted"}
          </div>
        ) : viewerIsProposer ? (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <svg className="h-3.5 w-3.5 animate-pulse" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            {t("waitingShort", { name: otherName }) || `Waiting for ${otherName}`}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={accepting}
              className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-accent-700 disabled:opacity-50"
            >
              {accepting ? (t("accepting") || "Accepting…") : (t("acceptDate") || "Accept this date")}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {t("proposeDifferent") || "Propose different"}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
      </div>

      <ChangeDateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setResolved("countered"); }}
        bookingId={bookingId}
        shootDate={payload.proposed_date}
        shootTime={payload.proposed_time}
        otherName={otherName}
      />
    </div>
  );
}
