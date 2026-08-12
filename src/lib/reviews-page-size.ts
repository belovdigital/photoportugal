// How many reviews the profile page paints before the visitor hits
// "show more". The Review JSON-LD is sliced to the same number: anything
// marked up beyond what's in the DOM is markup for invisible content, which
// disqualifies the whole review snippet (no stars in search).
//
// Lives in its own plain module on purpose. ReviewsPaginated is a client
// component, and a non-component export imported from a "use client" module
// into a server component arrives as a client-reference proxy, not a number
// — `slice(0, proxy)` coerces to NaN and silently emits an EMPTY review
// array. That shipped to prod for a few minutes on 2026-08-12.
export const REVIEWS_PAGE_SIZE = 5;
