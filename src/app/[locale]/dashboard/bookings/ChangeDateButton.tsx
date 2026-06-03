"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChangeDateModal } from "./ChangeDateModal";

// Inline button that lives next to the booking date in the Date card.
// Opens a modal with current date + new-date picker + optional note,
// per UX best-practice for "edit one field" flows.
export function ChangeDateButton({
  bookingId,
  shootDate,
  shootTime,
  otherName,
}: {
  bookingId: string;
  shootDate: string | null;
  shootTime?: string | null;
  otherName: string;
}) {
  const td = useTranslations("dateNegotiation");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {td("changeShort") || "Change"}
      </button>
      <ChangeDateModal
        open={open}
        onClose={() => setOpen(false)}
        bookingId={bookingId}
        shootDate={shootDate}
        shootTime={shootTime}
        otherName={otherName}
      />
    </>
  );
}
