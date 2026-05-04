const LISBON_TZ = "Europe/Lisbon";
const CANDIDATE_STEP_MINUTES = 15;

export const TIME_BUCKETS: Record<string, { start: number; end: number }> = {
  sunrise: { start: 6 * 60, end: 8 * 60 },
  morning: { start: 8 * 60, end: 11 * 60 },
  midday: { start: 11 * 60, end: 14 * 60 },
  afternoon: { start: 14 * 60, end: 17 * 60 },
  golden_hour: { start: 17 * 60, end: 19 * 60 },
  sunset: { start: 19 * 60, end: 21 * 60 },
  flexible: { start: 6 * 60, end: 21 * 60 },
};

export interface BusyWindow {
  starts_at: string;
  ends_at: string;
  source?: "calendar" | "booking";
}

function parseDateParts(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid shoot date: ${date}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = zone.match(/^GMT(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

export function lisbonLocalMinutesToUtc(date: string, minutesFromMidnight: number) {
  const { year, month, day } = parseDateParts(date);
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = new Date(wallAsUtc);
  const firstOffset = getTimeZoneOffsetMinutes(LISBON_TZ, firstGuess);
  const secondGuess = new Date(wallAsUtc - firstOffset * 60_000);
  const secondOffset = getTimeZoneOffsetMinutes(LISBON_TZ, secondGuess);
  return new Date(wallAsUtc - secondOffset * 60_000);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function candidateStartMinutes(shootTime: string | null | undefined): number[] {
  const value = shootTime || "flexible";
  const exact = value.match(/^(\d{2}):(\d{2})/);
  if (exact) return [Number(exact[1]) * 60 + Number(exact[2])];

  const bucket = TIME_BUCKETS[value] || TIME_BUCKETS.flexible;
  const starts: number[] = [];
  for (let minute = bucket.start; minute <= bucket.end; minute += CANDIDATE_STEP_MINUTES) {
    starts.push(minute);
  }
  return starts;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function hasAvailableBookingStart(
  shootDate: string,
  shootTime: string | null | undefined,
  durationMinutes: number,
  busyWindows: BusyWindow[]
) {
  const duration = Math.max(15, durationMinutes || 120);
  const starts = candidateStartMinutes(shootTime);

  return starts.some((candidateMinute) => {
    const start = lisbonLocalMinutesToUtc(shootDate, candidateMinute);
    const end = addMinutes(start, duration);
    return !busyWindows.some((busy) => overlaps(start, end, new Date(busy.starts_at), new Date(busy.ends_at)));
  });
}

export function internalBookingWindow(shootDate: string, shootTime: string | null, durationMinutes: number) {
  const value = shootTime || "flexible";
  const exact = value.match(/^(\d{2}):(\d{2})/);
  if (exact) {
    const start = lisbonLocalMinutesToUtc(shootDate, Number(exact[1]) * 60 + Number(exact[2]));
    return { start, end: addMinutes(start, Math.max(15, durationMinutes || 120)) };
  }

  const bucket = TIME_BUCKETS[value] || TIME_BUCKETS.flexible;
  const start = lisbonLocalMinutesToUtc(shootDate, bucket.start);
  const end = addMinutes(lisbonLocalMinutesToUtc(shootDate, bucket.end), Math.max(15, durationMinutes || 120));
  return { start, end };
}
