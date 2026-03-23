/**
 * Format a full name for public display: "FirstName L."
 * If no last name, returns just the first name.
 */
export function formatPublicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}
