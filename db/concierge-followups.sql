-- Phase D: post-match follow-up email tracking.
-- When a visitor sees their matches and gives us their email but does
-- nothing else, we nudge them once at ~30 minutes and once at ~24 hours.
-- This column records which stages were sent so the cron never doubles
-- up. Keys are stage names ('30min', '24h', etc.) → ISO timestamp.
ALTER TABLE concierge_chats
  ADD COLUMN IF NOT EXISTS followups_sent jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN concierge_chats.followups_sent IS
  'Stage → ISO timestamp of which follow-up emails have already been sent. Set by /api/cron/concierge-followups.';
