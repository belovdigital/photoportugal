-- Nudge photographers who finished stage one but never pressed "send me for review".
--
-- The gap this closes: the cron already chases an unfinished checklist (day 6
-- warning, day 7 deactivation) and an unconnected Stripe account after
-- approval (day 1/4/6). Nobody chased the step between them — a complete
-- profile sitting in the photographer's own dashboard, never submitted,
-- because asking for approval is a deliberate button press and not everyone
-- realises the profile does not move on its own.
--
-- `stage_one_ready_at` is stamped by the cron the first time it sees a
-- complete checklist, and cleared again if the profile falls back below the
-- bar (photos deleted, last package removed). There is no column recording
-- when the checklist went green, and deriving it from created_at would nudge
-- someone one day after registering rather than one day after becoming able
-- to act.

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS stage_one_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submit_nudge_d1_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submit_nudge_d3_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- The sweep runs every 15 minutes and only ever cares about photographers who
-- are not approved yet, which is a handful of rows per market.
CREATE INDEX IF NOT EXISTS idx_pp_stage_one_ready
  ON photographer_profiles (stage_one_ready_at)
  WHERE is_approved = FALSE AND approval_requested_at IS NULL;
