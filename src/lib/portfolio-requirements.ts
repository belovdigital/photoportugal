/**
 * How many portfolio photographs a photographer must upload before their
 * profile can go to review.
 *
 * Raised from 15 to 25 on 2026-08-02, for both markets. Fifteen turned out to
 * be too thin: a client comparing photographers cannot judge range or
 * consistency from fifteen frames, and the profiles that convert are the ones
 * that show a full session rather than highlights.
 *
 * This gates APPROVAL, not continued listing. Every check that uses it runs on
 * `is_approved = FALSE` rows, and the dashboard checklist is hidden once a
 * photographer is approved — so the 8 already-approved Portuguese photographers
 * with fewer than 25 photos are unaffected and are neither delisted nor nagged.
 */
export const MIN_PORTFOLIO_PHOTOS = 25;
