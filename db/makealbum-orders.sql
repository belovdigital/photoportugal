-- MakeAlbum checkout handshake — tracks album orders proxied through
-- PhotoPortugal. MakeAlbum owns album editing + production; we own the
-- customer payment leg (Stripe).
--
-- Lifecycle:
--   1. MakeAlbum POSTs /api/makealbum/checkout  → row inserted, status='pending'
--   2. Visitor pays on Stripe Checkout          → status='paid', shipping captured
--   3. We POST signed webhook to MakeAlbum      → webhook_delivered_at set
--
-- Idempotency key: (makealbum_order_id, makealbum_album_id). If MakeAlbum
-- retries the checkout request for the same (order, album) and the row's
-- Stripe session is still active, we return the existing checkoutUrl.

CREATE TABLE IF NOT EXISTS makealbum_orders (
  id                      VARCHAR(64) PRIMARY KEY,           -- pp_chk_...
  makealbum_order_id      VARCHAR(128) NOT NULL,
  makealbum_album_id      VARCHAR(128) NOT NULL,
  title                   TEXT,
  page_count              INTEGER,
  amount_cents            INTEGER NOT NULL,
  currency                VARCHAR(8) NOT NULL DEFAULT 'EUR',
  customer_email          VARCHAR(255),
  customer_name           VARCHAR(255),
  success_url             TEXT NOT NULL,
  cancel_url              TEXT NOT NULL,
  webhook_url             TEXT NOT NULL,
  status                  VARCHAR(32) NOT NULL DEFAULT 'pending',
                          -- pending | paid | expired | cancelled | failed
  stripe_session_id       VARCHAR(128),
  stripe_payment_intent_id VARCHAR(128),
  shipping_address        JSONB,
  webhook_delivered_at    TIMESTAMPTZ,
  webhook_attempts        INTEGER NOT NULL DEFAULT 0,
  webhook_last_error      TEXT,
  raw_request             JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at                 TIMESTAMPTZ,
  UNIQUE (makealbum_order_id, makealbum_album_id)
);

CREATE INDEX IF NOT EXISTS idx_makealbum_orders_stripe_session
  ON makealbum_orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_makealbum_orders_status_created
  ON makealbum_orders (status, created_at DESC);
