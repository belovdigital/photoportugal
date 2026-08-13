-- Starting roster for the partner outreach board — PORTUGAL ONLY.
--
-- Deliberately NOT a migration: these are Portuguese villa companies, and
-- migrations run on all three markets. Seeding them from db/migrations would
-- put Algarve property managers on the Spanish and Italian boards.
--
--   psql $DATABASE_URL -f db/partner-outreach-seed-pt.sql
--
-- Everything lands as 'new', not 'queued' — the send script only ever picks up
-- 'queued', so applying this file cannot mail anyone. Queueing is a human act.
--
-- Rows with no email are intentional: the company is worth writing to, the
-- mailbox just isn't published on their site. The board shows them as
-- "no email yet — can't be mailed" and the script skips them.
-- Safe to run multiple times (matched on company name).

INSERT INTO partner_outreach (company_name, website, email, segment, region, status, notes)
SELECT v.company_name, v.website, v.email, v.segment, v.region, 'new', v.notes
FROM (VALUES
  ('Enquinta',
   'https://enquinta.com/property-management-and-concierge-service-in-the-algarve/',
   'contact@enquinta.com',
   'property_manager', 'Algarve',
   'Property management + concierge, head office Quinta do Lago. Concierge already sells private chefs and transfers — a photoshoot is the next line on that menu.'),

  ('Comporta Vacation Homes',
   'https://comportavacationhomes.com/',
   'info@comportavacationhomes.com',
   'property_manager', 'Comporta',
   'Comporta houses with an integrated-services pitch. Small operator, decision-maker reads the info@ box.'),

  ('Pac4Portugal',
   'https://www.pac4portugal.com/',
   'enquiries@pac4portugal.com',
   'property_manager', 'Carvoeiro, Algarve',
   'Carvoeiro villas and properties. Family-run — expect a real person to answer.'),

  ('Algarve Agency (European Rentals Ltd)',
   'https://www.algarveagency.com/',
   'sales@european-rentals.co.uk',
   'property_manager', 'Albufeira, Algarve',
   'Albufeira holiday villas; the mailbox is the UK parent, European Rentals Ltd. Write in English, UK office hours.'),

  ('Villanovo',
   'https://www.villanovo.com/villa-rentals/europe/portugal/algarve/',
   NULL,
   'villa_aggregator', 'Algarve, Comporta',
   'Luxury villa aggregator with named concierge staff and destination pages for both Algarve and Comporta. Biggest domain of the batch — worth finding the right person rather than mailing a form.'),

  ('The Luxury Travel Book',
   'https://theluxurytravelbook.com/location/luxury-villas-and-apartments/portugal/',
   NULL,
   'villa_aggregator', 'national',
   'Luxury villas and apartments across Portugal. Editorial-style site, so the destination-guide pitch fits better than the concierge one.'),

  ('Isle Blue',
   'https://isleblue.co/portugal/villas',
   NULL,
   'villa_aggregator', 'national',
   'Portugal villa portfolio. Contact page blocks automated fetches — pull the address by hand.'),

  ('SpringVillas',
   'https://www.springvillas.net/',
   NULL,
   'villa_aggregator', 'Algarve',
   'Algarve villas, phone +351 282 492 215, no public mailbox — ask for it by phone or via their form.')
) AS v(company_name, website, email, segment, region, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM partner_outreach p
  WHERE lower(p.company_name) = lower(v.company_name)
);
