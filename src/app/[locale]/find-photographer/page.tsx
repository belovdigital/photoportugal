import { redirect } from "next/navigation";

// Retired in May 2026 — manual concierge-matching form was replaced by
// the AI Concierge at /concierge. Any inbound link (Google cache, blog
// references, bookmarks) lands on the AI flow instead of a dead page.
export default function FindPhotographerRedirect() {
  redirect("/concierge");
}
