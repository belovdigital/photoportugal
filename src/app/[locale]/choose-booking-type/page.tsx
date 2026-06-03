import { redirect } from "next/navigation";

// Retired in May 2026 — the gift/normal-booking picker page was killed
// in the AI-focused flow refactor. Direct visitors to the AI Concierge,
// which can route them to either a normal booking or a gift card.
export default function ChooseBookingTypeRedirect() {
  redirect("/concierge");
}
