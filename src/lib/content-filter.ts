/**
 * Detects potential contact information sharing in messages
 * Returns a warning message if detected, null if clean
 */
export function detectContactInfo(text: string): string | null {
  const patterns = [
    // Email
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, type: "email address" },
    // Phone numbers (international formats)
    { regex: /(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/, type: "phone number" },
    // URLs
    { regex: /https?:\/\/[^\s]+/i, type: "website link" },
    { regex: /www\.[^\s]+/i, type: "website link" },
    // Common social handles
    { regex: /@[a-zA-Z0-9_]{3,}(?:\s|$)/i, type: "social media handle" },
    // WhatsApp/Telegram mentions
    { regex: /\b(whatsapp|telegram|viber|signal)\b/i, type: "messaging app reference" },
  ];

  for (const { regex, type } of patterns) {
    if (regex.test(text)) {
      return type;
    }
  }

  return null;
}
