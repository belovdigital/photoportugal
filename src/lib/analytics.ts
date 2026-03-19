// GA4 event tracking for client user flow
// Funnel: Homepage → Browse → View Profile → Message/Book → Pay → Receive Photos → Review

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, params);
  }
}

// ===== FUNNEL EVENTS =====

// Step 1: Discovery
export function trackSearch(filters: { location?: string; shootType?: string }) {
  track("search", { search_term: [filters.location, filters.shootType].filter(Boolean).join(", ") });
}

// Step 2: Browse photographers
export function trackViewPhotographer(slug: string, name: string) {
  track("view_item", { item_id: slug, item_name: name, item_category: "photographer" });
}

// Step 3: Engagement
export function trackSendMessage(photographerId: string) {
  track("begin_checkout", { item_id: photographerId, step: "message" });
}

export function trackStartBooking(photographerSlug: string, packageName: string, price: number) {
  track("add_to_cart", {
    currency: "EUR",
    value: price,
    items: [{ item_id: photographerSlug, item_name: packageName, price }],
  });
}

// Step 4: Booking submitted
export function trackBookingSubmitted(photographerSlug: string, price: number) {
  track("begin_checkout", {
    currency: "EUR",
    value: price,
    items: [{ item_id: photographerSlug, price }],
  });
}

// Step 5: Payment completed
export function trackPaymentCompleted(bookingId: string, amount: number) {
  track("purchase", {
    transaction_id: bookingId,
    currency: "EUR",
    value: amount,
  });
}

// Step 6: Delivery accepted
export function trackDeliveryAccepted() {
  track("delivery_accepted");
}

// Step 7: Review left
export function trackReviewSubmitted(photographerSlug: string, rating: number) {
  track("review_submitted", { item_id: photographerSlug, rating });
}

// ===== PAGE-LEVEL EVENTS =====

export function trackSignUp(method: string, role: string) {
  track("sign_up", { method, role });
}

export function trackLocationView(slug: string) {
  track("view_item", { item_id: slug, item_category: "location" });
}

export function trackBlogView(slug: string) {
  track("view_item", { item_id: slug, item_category: "blog" });
}

export function trackJoinPageView() {
  track("view_item", { item_id: "join", item_category: "photographer_acquisition" });
}

export function trackCTAClick(ctaName: string, location: string) {
  track("select_content", { content_type: "cta", item_id: ctaName, creative_slot: location });
}
