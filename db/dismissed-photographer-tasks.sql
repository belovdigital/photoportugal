-- Photographer-dismissed action-needed tasks.
--
-- The dashboard surfaces tasks like "Respond to <client>", "Mark
-- session as done", "Upload delivery", etc. Some of these stay stuck
-- when the photographer deliberately chose not to act (deal didn't
-- close, shoot was cancelled offline, etc.). We can't enumerate every
-- such reason in code, so we let the photographer dismiss a task
-- manually.
--
-- `state_snapshot` records the underlying state value at dismissal
-- time (e.g. last_message_at for respond tasks). When fresh activity
-- changes that state, the dismissal is implicitly invalidated and the
-- task re-appears — important so a "respond" dismissal doesn't hide
-- a brand-new follow-up message from the same client.
CREATE TABLE IF NOT EXISTS dismissed_photographer_tasks (
  photographer_id UUID        NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
  task_key        TEXT        NOT NULL,
  state_snapshot  TEXT,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (photographer_id, task_key)
);
