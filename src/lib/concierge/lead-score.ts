// Heuristic lead score for a concierge chat. Hot leads are visitors
// who came from a paid ad, gave us a real intent signal (location +
// occasion + ideally a date), saw matches, and haven't booked yet.
// We use this to surface the highest-value chats first in admin and
// (later) to gate proactive follow-ups.

export type LeadHeat = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  email: string | null;
  phone: string | null;
  gclid: string | null;
  utm_source: string | null;
  outcome: string | null;
  matched_photographer_ids: string[] | null;
  inquiry_booking_ids: string[] | null;
  messages: { role: string; content: string }[];
  created_at: string | Date;
  updated_at: string | Date;
  /** Server-resolved shoot-type slug (wedding, couples…). Optional so older
   *  callers compile; when absent, no occasion weighting is applied. */
  occasion?: string | null;
}

const DATE_PATTERN = /\b(\d{1,2}[\/\.\- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\b|\bnext (week|month|weekend)\b|\bin \d+ (days?|weeks?|months?)\b|\b(this|next) (january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;

export function computeLeadScore(input: LeadScoreInput): { score: number; heat: LeadHeat } {
  let score = 0;

  if (input.email) score += 30;
  if (input.phone) score += 35; // phone is a stronger signal than email
  if (input.gclid) score += 20;
  else if (input.utm_source && input.utm_source !== "(direct)") score += 5;

  const userMsgs = (input.messages || []).filter((m) => m.role === "user");
  const allUserText = userMsgs.map((m) => m.content || "").join(" ");

  // Location/occasion mentioned (slug:hint counts as confirmed)
  if (/\(slug:[a-z0-9-]+\)/i.test(allUserText)) score += 15;

  // A date or timeframe mentioned anywhere in the conversation
  if (DATE_PATTERN.test(allUserText)) score += 25;

  // Outcome
  if (input.outcome === "matched" || input.outcome === "show_matches") score += 20;
  else if (input.outcome === "human_handoff") score += 25; // explicit handoff = high intent

  // Engagement depth
  if (userMsgs.length >= 5) score += 10;
  else if (userMsgs.length >= 3) score += 5;

  // Recency (active in last 24h)
  const updatedMs = new Date(input.updated_at).getTime();
  const ageHours = (Date.now() - updatedMs) / 3_600_000;
  if (ageHours < 1) score += 15;
  else if (ageHours < 24) score += 10;
  else if (ageHours > 24 * 7) score -= 10;

  // Occasion value tier. Weddings carry several times the LTV of a
  // standard portrait and a long, high-intent planning cycle — surface
  // them first and justify the extended nurture cadence. Other
  // wedding-adjacent occasions get a smaller lift.
  const occ = (input.occasion || "").toLowerCase();
  if (occ === "wedding") score += 25;
  else if (occ === "elopement" || occ === "engagement" || occ === "proposal" || occ === "honeymoon") score += 12;

  // Already converted to a booking — cold (we shouldn't keep marketing)
  if (input.inquiry_booking_ids && input.inquiry_booking_ids.length > 0) score -= 40;

  if (score >= 80) return { score, heat: "hot" };
  if (score >= 45) return { score, heat: "warm" };
  return { score, heat: "cold" };
}
