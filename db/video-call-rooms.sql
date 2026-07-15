-- 2026-07-15: per-instance video-call room state (LiveKit webhook).
--
-- Purpose: (1) start recording ONLY once 2+ human participants are in the
-- room — solo calls produce no audio files, no Deepgram spend, no
-- transcript; (2) admin Telegram "call happened" notification on
-- room_finished when the call actually had 2+ participants.
--
-- Keyed by room_sid (unique per room INSTANCE) — the room NAME
-- (pp-<client8>-<photog8>) is stable per pair and reused across calls.
CREATE TABLE IF NOT EXISTS video_call_rooms (
  room_sid TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  identities TEXT[] NOT NULL DEFAULT '{}',
  egress_started BOOLEAN NOT NULL DEFAULT FALSE,
  egressed_tracks TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_vcr_room ON video_call_rooms(room);
