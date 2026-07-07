// Today in the visitor's LOCAL timezone, as YYYY-MM-DD.
//
// Use this anywhere a date input compares against "today" — e.g. the
// `min` prop on DatePicker, or any "is the shoot in the past?" check
// in a client component.
//
// Why not `new Date().toISOString().split("T")[0]`? `toISOString()`
// returns UTC. A Lisbon photographer at 00:30 local on June 13 sees
// UTC 23:30 June 12, and the UTC string returns "2026-06-12" — so the
// date picker happily accepts June 12 (their yesterday) as a valid
// shoot date. Real bug, real complaint. This helper formats from the
// LOCAL getFullYear/getMonth/getDate so today is always today for the
// user holding the device.
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Today + N days in the visitor's local timezone, as YYYY-MM-DD.
// Useful when a min booking date needs to honour a photographer's
// minimum lead time ("can be booked no sooner than 48h from now").
export function localISOPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
