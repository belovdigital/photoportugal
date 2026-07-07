-- Normalize legacy portfolio_items.shoot_type values to canonical
-- SHOOT_TYPES names.
--
-- Photographers tagged photos with BOTH slug/lowercase forms ("wedding",
-- "solo", "content-creator") and canonical names ("Wedding", "Solo
-- Portrait"), so a single portfolio rendered duplicate filter pills
-- (reported 2026-06-13: "I see twice 'wedding' and solo & solo-portrait").
--
-- The API write path now canonicalizes on write
-- (src/lib/shoot-type-labels.ts → canonicalizeShootType, applied in
-- src/app/api/dashboard/portfolio/route.ts). This back-fills existing rows.
--
-- Idempotent: re-running matches nothing once normalized.
UPDATE portfolio_items SET shoot_type = 'Wedding'         WHERE shoot_type = 'wedding';
UPDATE portfolio_items SET shoot_type = 'Solo Portrait'   WHERE shoot_type = 'solo';
UPDATE portfolio_items SET shoot_type = 'Couples'         WHERE shoot_type = 'couples';
UPDATE portfolio_items SET shoot_type = 'Family'          WHERE shoot_type = 'family';
UPDATE portfolio_items SET shoot_type = 'Elopement'       WHERE shoot_type = 'elopement';
UPDATE portfolio_items SET shoot_type = 'Honeymoon'       WHERE shoot_type = 'honeymoon';
UPDATE portfolio_items SET shoot_type = 'Maternity'       WHERE shoot_type = 'maternity';
UPDATE portfolio_items SET shoot_type = 'Content Creator' WHERE shoot_type = 'content-creator';
UPDATE portfolio_items SET shoot_type = 'Friends Trip'    WHERE shoot_type = 'friends';
