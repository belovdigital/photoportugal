-- Preserve "9+" group-size intent from the old booking form.
-- Safe to run multiple times.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS group_size_is_estimate BOOLEAN DEFAULT FALSE;

UPDATE bookings
SET group_size_is_estimate = TRUE
WHERE group_size = 9
  AND COALESCE(group_size_is_estimate, FALSE) = FALSE;

COMMENT ON COLUMN bookings.group_size_is_estimate IS 'TRUE when the selected group size represents a lower-bound value such as 9+ rather than an exact count.';
