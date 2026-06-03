import { randomUUID } from "crypto";

// Tentative blind-booking offers held in-memory between the LLM
// emitting offer_blind_booking and the client clicking Yes. Once the
// client accepts and a real booking row is INSERTed, the hold is
// consumed and dropped. If the user navigates away or declines, the
// hold expires on its own.
//
// In-memory (per next-server process) is fine here: holds live for at
// most ~5 minutes and there's no harm if a hold is lost on deploy —
// the user just re-asks the AI to "book it" and we mint a new one.

export interface HoldPayload {
  chat_id: string;
  region: string;
  date: string;
  occasion: string;
  party_size: number;
  duration_minutes: number;
  price_eur: number;
  created_at: number;
}

const HOLD_TTL_MS = 5 * 60 * 1000;
const holds = new Map<string, HoldPayload>();

function gc() {
  const now = Date.now();
  for (const [id, p] of holds) {
    if (now - p.created_at > HOLD_TTL_MS) holds.delete(id);
  }
}

export function mintHold(payload: Omit<HoldPayload, "created_at">): string {
  gc();
  const id = randomUUID();
  holds.set(id, { ...payload, created_at: Date.now() });
  return id;
}

export function getHold(holdId: string): HoldPayload | null {
  gc();
  return holds.get(holdId) ?? null;
}

export function consumeHold(holdId: string): HoldPayload | null {
  gc();
  const p = holds.get(holdId);
  if (!p) return null;
  holds.delete(holdId);
  return p;
}

export function clearHold(holdId: string): void {
  holds.delete(holdId);
}
