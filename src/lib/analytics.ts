// GA4 event tracking for client user flow
// Funnel: Homepage → Browse → View Profile → Message/Book → Pay → Receive Photos → Review

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const ADS_ID = "AW-18043729532";

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, params);
  }
}

function trackAdsConversion(label: string, value?: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${ADS_ID}/${label}`,
      ...(value ? { value, currency: "EUR" } : {}),
    });
  }
}

// ===== PAGE VIEW TRACKING (for ad visitor journeys) =====

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  const utmSource = sessionStorage.getItem("utm_source");
  if (!utmSource) return; // only track ad visitors
  fetch("/api/track-pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, utm_source: utmSource }),
  }).catch(() => {});
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

// Step 4: Booking submitted (with value for Google Ads optimization)
export function trackBookingSubmitted(photographerSlug: string, price: number) {
  track("begin_checkout", {
    currency: "EUR",
    value: price,
    items: [{ item_id: photographerSlug, price }],
  });
  trackAdsConversion("eNkuCKKespMcEPzs9ZtD", Number(price));
}

// Step 5: Payment completed (with value for Google Ads optimization)
export function trackPaymentCompleted(bookingId: string, amount: number) {
  track("purchase", {
    transaction_id: bookingId,
    currency: "EUR",
    value: amount,
  });
  trackAdsConversion("nNt3CKWespMcEPzs9ZtD", Number(amount));
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
  if (role === "client") trackAdsConversion("eNkuCKKespMcEPzs9ZtD");
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
