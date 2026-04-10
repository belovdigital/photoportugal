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

/**
 * Detects social media platform mentions (Instagram, Facebook) in messages.
 * Returns "instagram" or "facebook" if mentioned, null if clean.
 *
 * This is separate from detectContactInfo because it has different behavior:
 * - Clients: message is BLOCKED (not sent)
 * - Photographers: message is sent but with a system warning
 *
 * Does NOT trigger if the user is sharing a link to their OWN profile
 * (e.g. "here's my instagram: instagram.com/myname" is ok for clients to share).
 */
export function detectSocialPlatform(text: string, senderRole: "client" | "photographer"): "instagram" | "facebook" | null {
  const lower = text.toLowerCase();

  // Instagram variations (including common typos)
  const instaPatterns = /\b(instagram|instagra[mn]|insta[gq]ram|istagram|instagam|instagrm|instgram|insta)\b/i;
  // Facebook variations
  const fbPatterns = /\b(facebook|face\s?book|facbook|facebok|fb\.com)\b/i;

  const hasInsta = instaPatterns.test(lower);
  const hasFb = fbPatterns.test(lower);

  if (!hasInsta && !hasFb) return null;

  // If client is sharing their OWN link (instagram.com/... or facebook.com/...),
  // that's fine — they're giving the photographer context, not asking to go off-platform
  if (senderRole === "client") {
    const hasInstaLink = /instagram\.com\/[a-zA-Z0-9_.]+/i.test(text);
    const hasFbLink = /facebook\.com\/[a-zA-Z0-9_.]+/i.test(text);
    // If the only social mention is their own link, allow it
    if (hasInsta && hasInstaLink && !hasFb) return null;
    if (hasFb && hasFbLink && !hasInsta) return null;
    if (hasInsta && hasInstaLink && hasFb && hasFbLink) return null;
  }

  return hasInsta ? "instagram" : "facebook";
}
