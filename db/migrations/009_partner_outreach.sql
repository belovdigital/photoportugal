-- Link/referral partner outreach board (2026-08-13).
--
-- Accommodation-side partnerships: villa rental aggregators, property
-- managers and concierge companies whose guests already ask them for a
-- photographer. We ask for a linked mention on their experiences page and
-- link back from our location guides. No discount, no commission — see the
-- pitch in scripts/send-partner-outreach.mjs.
--
-- Why a table and not a spreadsheet: the send script has to know who was
-- already written to. Outreach that double-mails a company reads as spam and
-- burns the contact, and notification_logs alone cannot answer "who is left"
-- because it holds no company, segment or reply state.
--
-- last_contacted_at + contact_count are written by the send script itself, in
-- the same transaction as the status flip, so a crash mid-run cannot leave a
-- row that was mailed but looks untouched.
--
-- their_link_url is the point of the whole exercise: the page where the
-- partner actually linked us. A deal is 'partner' only when that URL exists.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS partner_outreach (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      VARCHAR(200) NOT NULL,
  website           VARCHAR(500),
  email             VARCHAR(255),
  contact_name      VARCHAR(200),
  -- villa_aggregator / property_manager / concierge / hotel / other
  segment           VARCHAR(40) NOT NULL DEFAULT 'other',
  -- free-form market label: Algarve / Comporta / Lisbon / Porto / Douro / national
  region            VARCHAR(100),
  -- new → queued → contacted → replied → partner | declined
  status            VARCHAR(20) NOT NULL DEFAULT 'new',
  notes             TEXT,
  last_contacted_at TIMESTAMPTZ,
  contact_count     INT NOT NULL DEFAULT 0,
  their_link_url    VARCHAR(500),
  our_link_url      VARCHAR(500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per mailbox. Partial index because a company can sit in the list
-- with no contact found yet, and several of those must not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_outreach_email
  ON partner_outreach (lower(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_outreach_status ON partner_outreach (status);
CREATE INDEX IF NOT EXISTS idx_partner_outreach_created ON partner_outreach (created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('009_partner_outreach.sql')
ON CONFLICT DO NOTHING;
