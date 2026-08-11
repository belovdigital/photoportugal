-- Every fiscal document the platform issues, whatever it is for.
--
-- Bookings got their columns on `bookings` first (migration 006) and keep them:
-- four real documents already point at them and moving live fiscal records is
-- not worth the risk. Everything issued from here on — photographer add-on
-- subscriptions, extra-photo purchases — lands in this table instead.
--
-- The unique constraint is the point. On `bookings` the index guarded
-- (invoicexpress_invoice_id), which stops one InvoiceXpress id appearing on two
-- rows — nearly free, since their ids are unique anyway — and does NOT stop one
-- source getting two documents. Here the key is the SOURCE, so a second
-- document for the same subscription period or the same extras order cannot be
-- written even if two runs race or a crash lands mid-flight.
CREATE TABLE IF NOT EXISTS issued_documents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'subscription' → source_id is a Stripe invoice id (one per billing cycle)
  -- 'extras'       → source_id is delivery_extra_purchases.order_id
  source_type              text NOT NULL,
  source_id                text NOT NULL,
  photographer_id          uuid REFERENCES photographer_profiles(id),
  client_id                uuid REFERENCES users(id),
  amount_eur               numeric(10,2) NOT NULL,
  document_date            date NOT NULL,
  invoicexpress_invoice_id text,
  -- 'claiming' is written BEFORE the document is created, so a crash between
  -- the API call and the write leaves a row that blocks a duplicate instead of
  -- inviting one.
  state                    text NOT NULL DEFAULT 'claiming',
  error                    text,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  issued_at                timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS issued_documents_source_key
  ON issued_documents (source_type, source_id);

CREATE INDEX IF NOT EXISTS issued_documents_state_idx
  ON issued_documents (state) WHERE state <> 'final';

INSERT INTO schema_migrations (version) VALUES ('007_issued_documents.sql')
ON CONFLICT DO NOTHING;
