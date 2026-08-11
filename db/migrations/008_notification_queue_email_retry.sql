-- Keep refused email alive long enough to actually deliver it, and make its
-- death visible.
--
-- Until 2026-08-11 sendEmail() made one SMTP attempt and swallowed the
-- failure, so notification_queue rows were DELETEd whether the server had
-- taken the message or refused it — prod had zero 'failed' rows and
-- max(attempts)=1 across 570 rows since May. Eight emails died that way in
-- 30 days, including a photographer's "your shoot is tomorrow" for a paid
-- proposal shoot and a signup verification we only heard about because the
-- photographer complained.
--
-- alerted_at: set once a dead ('failed') email has been reported to
-- Telegram. It cannot reuse sent_at — despite the name, that column is only
-- ever written on cancellation, never on delivery, because a delivered row
-- is deleted. NULL means "not paged yet"; the claim-and-page UPDATE is what
-- stops two overlapping cron drains reporting the same death twice.
--
-- reply_to: a retried email must arrive with the same Reply-To it would
-- have had on the first attempt. Inquiry and message notifications set it so
-- a staff reply reaches the client directly; without the column, a message
-- that went out via the retry path would silently answer info@ instead.
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS alerted_at timestamptz;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS reply_to varchar(255);

-- Small table (7-day retention), but the alerter scans it every minute.
CREATE INDEX IF NOT EXISTS idx_notification_queue_dead_unalerted
  ON notification_queue (channel, created_at)
  WHERE status = 'failed' AND alerted_at IS NULL;

INSERT INTO schema_migrations (version) VALUES ('008_notification_queue_email_retry.sql')
ON CONFLICT DO NOTHING;
