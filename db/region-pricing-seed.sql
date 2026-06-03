-- Seed region_pricing — 7 regions × 10 occasions × 3 durations = 210 rows.
--
-- Prices are regional median €/hour × duration_hours, rounded to €5.
-- Occasion is a copy of the regional median because per-(region,occasion)
-- samples are too thin to be meaningful (max 9 paid bookings per occasion
-- in 180d). Refreshed nightly by /api/cron/region-pricing-refresh.
--
-- ON CONFLICT keeps idempotency — re-run safely after changes.

INSERT INTO region_pricing (region, occasion, duration_minutes, price_eur, sample_size) VALUES
-- greater-lisbon (median €220/h, n=78)
('greater-lisbon','anniversary',60,220,78),('greater-lisbon','anniversary',120,440,78),('greater-lisbon','anniversary',180,660,78),
('greater-lisbon','birthday',60,220,78),('greater-lisbon','birthday',120,440,78),('greater-lisbon','birthday',180,660,78),
('greater-lisbon','elopement',60,220,78),('greater-lisbon','elopement',120,440,78),('greater-lisbon','elopement',180,660,78),
('greater-lisbon','engagement',60,220,78),('greater-lisbon','engagement',120,440,78),('greater-lisbon','engagement',180,660,78),
('greater-lisbon','family',60,220,78),('greater-lisbon','family',120,440,78),('greater-lisbon','family',180,660,78),
('greater-lisbon','honeymoon',60,220,78),('greater-lisbon','honeymoon',120,440,78),('greater-lisbon','honeymoon',180,660,78),
('greater-lisbon','maternity',60,220,78),('greater-lisbon','maternity',120,440,78),('greater-lisbon','maternity',180,660,78),
('greater-lisbon','other',60,220,78),('greater-lisbon','other',120,440,78),('greater-lisbon','other',180,660,78),
('greater-lisbon','proposal',60,220,78),('greater-lisbon','proposal',120,440,78),('greater-lisbon','proposal',180,660,78),
('greater-lisbon','vacation',60,220,78),('greater-lisbon','vacation',120,440,78),('greater-lisbon','vacation',180,660,78),
-- northern-portugal (median €190/h, n=55)
('northern-portugal','anniversary',60,190,55),('northern-portugal','anniversary',120,380,55),('northern-portugal','anniversary',180,570,55),
('northern-portugal','birthday',60,190,55),('northern-portugal','birthday',120,380,55),('northern-portugal','birthday',180,570,55),
('northern-portugal','elopement',60,190,55),('northern-portugal','elopement',120,380,55),('northern-portugal','elopement',180,570,55),
('northern-portugal','engagement',60,190,55),('northern-portugal','engagement',120,380,55),('northern-portugal','engagement',180,570,55),
('northern-portugal','family',60,190,55),('northern-portugal','family',120,380,55),('northern-portugal','family',180,570,55),
('northern-portugal','honeymoon',60,190,55),('northern-portugal','honeymoon',120,380,55),('northern-portugal','honeymoon',180,570,55),
('northern-portugal','maternity',60,190,55),('northern-portugal','maternity',120,380,55),('northern-portugal','maternity',180,570,55),
('northern-portugal','other',60,190,55),('northern-portugal','other',120,380,55),('northern-portugal','other',180,570,55),
('northern-portugal','proposal',60,190,55),('northern-portugal','proposal',120,380,55),('northern-portugal','proposal',180,570,55),
('northern-portugal','vacation',60,190,55),('northern-portugal','vacation',120,380,55),('northern-portugal','vacation',180,570,55),
-- central-portugal (median €200/h, n=41)
('central-portugal','anniversary',60,200,41),('central-portugal','anniversary',120,400,41),('central-portugal','anniversary',180,600,41),
('central-portugal','birthday',60,200,41),('central-portugal','birthday',120,400,41),('central-portugal','birthday',180,600,41),
('central-portugal','elopement',60,200,41),('central-portugal','elopement',120,400,41),('central-portugal','elopement',180,600,41),
('central-portugal','engagement',60,200,41),('central-portugal','engagement',120,400,41),('central-portugal','engagement',180,600,41),
('central-portugal','family',60,200,41),('central-portugal','family',120,400,41),('central-portugal','family',180,600,41),
('central-portugal','honeymoon',60,200,41),('central-portugal','honeymoon',120,400,41),('central-portugal','honeymoon',180,600,41),
('central-portugal','maternity',60,200,41),('central-portugal','maternity',120,400,41),('central-portugal','maternity',180,600,41),
('central-portugal','other',60,200,41),('central-portugal','other',120,400,41),('central-portugal','other',180,600,41),
('central-portugal','proposal',60,200,41),('central-portugal','proposal',120,400,41),('central-portugal','proposal',180,600,41),
('central-portugal','vacation',60,200,41),('central-portugal','vacation',120,400,41),('central-portugal','vacation',180,600,41),
-- alentejo (median €189/h, n=7)
('alentejo','anniversary',60,190,7),('alentejo','anniversary',120,380,7),('alentejo','anniversary',180,565,7),
('alentejo','birthday',60,190,7),('alentejo','birthday',120,380,7),('alentejo','birthday',180,565,7),
('alentejo','elopement',60,190,7),('alentejo','elopement',120,380,7),('alentejo','elopement',180,565,7),
('alentejo','engagement',60,190,7),('alentejo','engagement',120,380,7),('alentejo','engagement',180,565,7),
('alentejo','family',60,190,7),('alentejo','family',120,380,7),('alentejo','family',180,565,7),
('alentejo','honeymoon',60,190,7),('alentejo','honeymoon',120,380,7),('alentejo','honeymoon',180,565,7),
('alentejo','maternity',60,190,7),('alentejo','maternity',120,380,7),('alentejo','maternity',180,565,7),
('alentejo','other',60,190,7),('alentejo','other',120,380,7),('alentejo','other',180,565,7),
('alentejo','proposal',60,190,7),('alentejo','proposal',120,380,7),('alentejo','proposal',180,565,7),
('alentejo','vacation',60,190,7),('alentejo','vacation',120,380,7),('alentejo','vacation',180,565,7),
-- algarve (median €300/h, n=27)
('algarve','anniversary',60,300,27),('algarve','anniversary',120,600,27),('algarve','anniversary',180,900,27),
('algarve','birthday',60,300,27),('algarve','birthday',120,600,27),('algarve','birthday',180,900,27),
('algarve','elopement',60,300,27),('algarve','elopement',120,600,27),('algarve','elopement',180,900,27),
('algarve','engagement',60,300,27),('algarve','engagement',120,600,27),('algarve','engagement',180,900,27),
('algarve','family',60,300,27),('algarve','family',120,600,27),('algarve','family',180,900,27),
('algarve','honeymoon',60,300,27),('algarve','honeymoon',120,600,27),('algarve','honeymoon',180,900,27),
('algarve','maternity',60,300,27),('algarve','maternity',120,600,27),('algarve','maternity',180,900,27),
('algarve','other',60,300,27),('algarve','other',120,600,27),('algarve','other',180,900,27),
('algarve','proposal',60,300,27),('algarve','proposal',120,600,27),('algarve','proposal',180,900,27),
('algarve','vacation',60,300,27),('algarve','vacation',120,600,27),('algarve','vacation',180,900,27),
-- madeira (median €250/h, n=6)
('madeira','anniversary',60,250,6),('madeira','anniversary',120,500,6),('madeira','anniversary',180,750,6),
('madeira','birthday',60,250,6),('madeira','birthday',120,500,6),('madeira','birthday',180,750,6),
('madeira','elopement',60,250,6),('madeira','elopement',120,500,6),('madeira','elopement',180,750,6),
('madeira','engagement',60,250,6),('madeira','engagement',120,500,6),('madeira','engagement',180,750,6),
('madeira','family',60,250,6),('madeira','family',120,500,6),('madeira','family',180,750,6),
('madeira','honeymoon',60,250,6),('madeira','honeymoon',120,500,6),('madeira','honeymoon',180,750,6),
('madeira','maternity',60,250,6),('madeira','maternity',120,500,6),('madeira','maternity',180,750,6),
('madeira','other',60,250,6),('madeira','other',120,500,6),('madeira','other',180,750,6),
('madeira','proposal',60,250,6),('madeira','proposal',120,500,6),('madeira','proposal',180,750,6),
('madeira','vacation',60,250,6),('madeira','vacation',120,500,6),('madeira','vacation',180,750,6),
-- azores (median €200/h, n=13)
('azores','anniversary',60,200,13),('azores','anniversary',120,400,13),('azores','anniversary',180,600,13),
('azores','birthday',60,200,13),('azores','birthday',120,400,13),('azores','birthday',180,600,13),
('azores','elopement',60,200,13),('azores','elopement',120,400,13),('azores','elopement',180,600,13),
('azores','engagement',60,200,13),('azores','engagement',120,400,13),('azores','engagement',180,600,13),
('azores','family',60,200,13),('azores','family',120,400,13),('azores','family',180,600,13),
('azores','honeymoon',60,200,13),('azores','honeymoon',120,400,13),('azores','honeymoon',180,600,13),
('azores','maternity',60,200,13),('azores','maternity',120,400,13),('azores','maternity',180,600,13),
('azores','other',60,200,13),('azores','other',120,400,13),('azores','other',180,600,13),
('azores','proposal',60,200,13),('azores','proposal',120,400,13),('azores','proposal',180,600,13),
('azores','vacation',60,200,13),('azores','vacation',120,400,13),('azores','vacation',180,600,13)
ON CONFLICT (region, occasion, duration_minutes) DO UPDATE
  SET price_eur = EXCLUDED.price_eur,
      sample_size = EXCLUDED.sample_size,
      updated_at = NOW();
