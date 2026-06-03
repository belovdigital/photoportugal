-- Local metadata for Stripe promo codes. The codes themselves live in
-- Stripe (source of truth for the discount logic + redemption count);
-- this table layers admin-only context on top so the admin panel can
-- show source, notes, and audit trail.
--
-- code  : the Stripe promotion_code.code (e.g. REVIEW-LW7MKF). Used as
--         the join key so we don't have to track Stripe IDs separately.
-- notes : free-text admin note. Optional.
-- source: where the code came from:
--   'admin_panel'   — created via /admin Create Promo Code form
--   'review'        — auto-issued for a regular text review (10% off)
--   'video_review'  — auto-issued for a video review (15% off)
--   'manual_stripe' — exists in Stripe but we have no record (created
--                     directly in Stripe Dashboard). Inferred at read time.
-- created_by_email: admin who clicked Create (only for admin_panel codes).

CREATE TABLE IF NOT EXISTS promo_codes_meta (
  code              TEXT PRIMARY KEY,
  notes             TEXT,
  created_by_email  TEXT,
  source            TEXT NOT NULL DEFAULT 'admin_panel',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_meta_source ON promo_codes_meta (source);
