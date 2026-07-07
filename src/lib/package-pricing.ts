// Duration options and pricing guidelines for photographer packages
// Used by: dashboard form, API validation, admin flagging

export interface DurationOption {
  minutes: number;
  label: string;
  minPrice: number;
  recommendedPrice: number;
}

// 2026-06-12: floors raised to €299 minimum across all durations
// (psychological pricing — under €300 reads as more accessible).
// 15-min and 30-min slots dropped entirely — never gained traction
// (~2 paid bookings ever for 30-min, zero for 15-min), and they
// don't make sense at a €299 floor anyway. 45-min stays as the
// shortest available slot for photographers who want a quick
// headshot/branding option, but priced at €299+ like the rest.
// Anchor: 60min = €299 (was €135). Longer durations scale with a
// softening per-hour rate (industry standard for wedding/event work).
export const DURATION_OPTIONS: DurationOption[] = [
  { minutes: 45, label: "45 min", minPrice: 299, recommendedPrice: 350 },
  { minutes: 60, label: "1 hour", minPrice: 299, recommendedPrice: 400 },
  { minutes: 90, label: "1.5 hours", minPrice: 380, recommendedPrice: 500 },
  { minutes: 120, label: "2 hours", minPrice: 450, recommendedPrice: 600 },
  { minutes: 150, label: "2.5 hours", minPrice: 530, recommendedPrice: 720 },
  { minutes: 180, label: "3 hours", minPrice: 600, recommendedPrice: 820 },
  { minutes: 210, label: "3.5 hours", minPrice: 670, recommendedPrice: 920 },
  { minutes: 240, label: "4 hours", minPrice: 740, recommendedPrice: 1020 },
  { minutes: 300, label: "5 hours", minPrice: 870, recommendedPrice: 1200 },
  { minutes: 360, label: "6 hours", minPrice: 1000, recommendedPrice: 1380 },
  { minutes: 420, label: "7 hours", minPrice: 1130, recommendedPrice: 1550 },
  { minutes: 480, label: "8 hours", minPrice: 1250, recommendedPrice: 1720 },
  { minutes: 600, label: "10 hours", minPrice: 1500, recommendedPrice: 2050 },
  { minutes: 720, label: "Full Day (12h)", minPrice: 1800, recommendedPrice: 2400 },
];

export function getPricingForDuration(minutes: number): { minPrice: number; recommendedPrice: number } | null {
  const option = DURATION_OPTIONS.find((o) => o.minutes === minutes);
  return option ? { minPrice: option.minPrice, recommendedPrice: option.recommendedPrice } : null;
}

// Per-locale words for duration labels. Falls back to English.
const DURATION_WORDS: Record<string, { min: string; hour: string; hours: string; halfHour: string; fullDay: string }> = {
  en: { min: "min", hour: "hour", hours: "hours", halfHour: "1.5 hours", fullDay: "Full Day (12h)" },
  pt: { min: "min", hour: "hora", hours: "horas", halfHour: "1,5 horas", fullDay: "Dia inteiro (12h)" },
  de: { min: "Min.", hour: "Stunde", hours: "Stunden", halfHour: "1,5 Stunden", fullDay: "Ganzer Tag (12h)" },
  es: { min: "min", hour: "hora", hours: "horas", halfHour: "1,5 horas", fullDay: "Día completo (12h)" },
  fr: { min: "min", hour: "heure", hours: "heures", halfHour: "1,5 heures", fullDay: "Journée entière (12h)" },
};

export function formatDuration(minutes: number, locale = "en"): string {
  const w = DURATION_WORDS[locale] || DURATION_WORDS.en;
  if (minutes < 60) return `${minutes} ${w.min}`;
  if (minutes === 720) return w.fullDay;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? w.hour : w.hours}`;
  }
  // Half-hour increments (90, 150, 210...).
  const hours = minutes / 60;
  if (hours === 1.5) return w.halfHour;
  // Locale decimal separator: pt/de/es/fr use comma, en uses dot.
  const sep = locale === "en" ? "." : ",";
  return `${hours.toFixed(1).replace(".", sep)} ${w.hours}`;
}

export function isBelowMinimum(durationMinutes: number, price: number): boolean {
  const pricing = getPricingForDuration(durationMinutes);
  if (!pricing) return false;
  return price < pricing.minPrice;
}
