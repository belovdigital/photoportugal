-- Booking/calendar buffer between events.
-- Photographers can choose how much time before and after external calendar
-- events and Photo Portugal bookings should be protected from new bookings.

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS calendar_buffer_minutes INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'photographer_profiles_calendar_buffer_minutes_check'
  ) THEN
    ALTER TABLE photographer_profiles
      ADD CONSTRAINT photographer_profiles_calendar_buffer_minutes_check
      CHECK (calendar_buffer_minutes >= 0 AND calendar_buffer_minutes <= 1440)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE photographer_profiles
  VALIDATE CONSTRAINT photographer_profiles_calendar_buffer_minutes_check;
