import { redirect } from "next/navigation";

// Calendar sync now lives inside the Availability page, so old links to
// /dashboard/calendar-sync just bounce there. Forwards any querystring
// (e.g. ?connected=google&email=...) so the OAuth callback banner still
// renders on the destination.
export default async function CalendarSyncRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/dashboard/availability${tail ? `?${tail}` : ""}`);
}
