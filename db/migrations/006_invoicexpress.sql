-- Link a booking to the platform's own invoice in InvoiceXpress.
--
-- The platform invoices the CLIENT for its share of the all-in price (what the
-- client actually paid, minus the photographer's payout). The photographer
-- invoices the client separately for their payout; we never invoice them.
--
-- `invoicexpress_invoice_id` is the idempotency key: a booking with one set
-- never gets a second document. A finalised InvoiceXpress document cannot be
-- deleted — only credited — so a duplicate is not a bug you fix, it is a bug
-- you apologise for. Written BEFORE the finalise call, not after.
--
-- `invoicexpress_state` mirrors the document state we last observed
-- ('draft' | 'final' | 'error'); the API remains the source of truth.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoicexpress_invoice_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoicexpress_state text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoicexpress_issued_at timestamptz;

-- NOTE what this index does and does not do. It stops one InvoiceXpress id
-- appearing on two bookings — which is nearly free, since their ids are already
-- unique — and it does NOT stop one booking receiving two documents, because
-- that is a sequence of two different ids. One-per-booking is enforced by the
-- issuing code claiming the row (invoicexpress_state='claiming') BEFORE the
-- document is created; see scripts/invoicexpress-dry-run.mjs.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_invoicexpress_invoice_id_key
  ON bookings (invoicexpress_invoice_id)
  WHERE invoicexpress_invoice_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('006_invoicexpress.sql')
ON CONFLICT DO NOTHING;
