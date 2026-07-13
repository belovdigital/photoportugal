import { query } from "@/lib/db";

/**
 * Chart-annotation telemetry: dashboard mutation APIs call this after a
 * successful write so /dashboard/stats can draw "profile changed here"
 * markers on the views timeline (photographers asked to "test" cover/
 * pricing changes — this closes that loop).
 *
 * Fire-and-forget by design: never let telemetry break a profile save.
 * Fields are open-coded: profile | cover | avatar | packages | portfolio.
 */
export function logProfileChange(photographerId: string, field: string): void {
  if (!photographerId) return;
  query(
    "INSERT INTO photographer_profile_changes (photographer_id, field) VALUES ($1, $2)",
    [photographerId, field],
  ).catch(() => {});
}
