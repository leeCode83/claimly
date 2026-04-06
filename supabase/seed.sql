-- =============================================================================
-- SEED DATA: institutions (10 hospital + 10 insurance)
-- =============================================================================
-- Cara push ke Supabase:
--   Via SQL Editor di Supabase Dashboard: copy-paste lalu Run
--   Via CLI: supabase db execute --file supabase/seed.sql
-- =============================================================================

INSERT INTO public.institutions (id, name, type, license_number, address, is_active, created_at)
VALUES
  -- === HOSPITALS ===
  ('11111111-0001-0000-0000-000000000000', 'RS Mitra Sehat',        'hospital',   'RSU-2021-001', 'Jl. Sudirman No. 12, Jakarta Pusat',        true, NOW()),
  ('11111111-0002-0000-0000-000000000000', 'RSUD Harapan Bunda',    'hospital',   'RSU-2019-042', 'Jl. Pahlawan No. 7, Bandung',               true, NOW()),
  ('11111111-0003-0000-0000-000000000000', 'RS Kasih Ibu',          'hospital',   'RSU-2020-115', 'Jl. Diponegoro No. 88, Surabaya',           true, NOW()),
  ('11111111-0004-0000-0000-000000000000', 'RS Budi Mulya',         'hospital',   'RSU-2018-033', 'Jl. Ahmad Yani No. 55, Medan',              true, NOW()),
  ('11111111-0005-0000-0000-000000000000', 'RS Pelita Bangsa',      'hospital',   'RSU-2022-007', 'Jl. Gajah Mada No. 100, Semarang',          true, NOW()),
  ('11111111-0006-0000-0000-000000000000', 'RS Siloam Utama',       'hospital',   'RSU-2017-088', 'Jl. Thamrin No. 45, Jakarta Selatan',       true, NOW()),
  ('11111111-0007-0000-0000-000000000000', 'RS Pondok Indah',       'hospital',   'RSU-2016-201', 'Jl. Metro Pondok Indah, Jakarta Selatan',   true, NOW()),
  ('11111111-0008-0000-0000-000000000000', 'RSUP Dr. Sardjito',     'hospital',   'RSU-2015-009', 'Jl. Kesehatan No. 1, Yogyakarta',           true, NOW()),
  ('11111111-0009-0000-0000-000000000000', 'RS Advent Bandung',     'hospital',   'RSU-2014-077', 'Jl. Cihampelas No. 161, Bandung',           true, NOW()),
  ('11111111-0010-0000-0000-000000000000', 'RS Columbia Asia',      'hospital',   'RSU-2023-003', 'Jl. Puri Kencana No. 1, Tangerang',         true, NOW()),

  -- === INSURANCE ===
  ('22222222-0001-0000-0000-000000000000', 'PT Asuransi Jiwa Raya',  'insurance', 'INS-2018-001', 'Jl. Thamrin No. 9, Jakarta Pusat',          true, NOW()),
  ('22222222-0002-0000-0000-000000000000', 'Prudential Indonesia',   'insurance', 'INS-2016-022', 'Jl. Sudirman Kav. 79, Jakarta Selatan',     true, NOW()),
  ('22222222-0003-0000-0000-000000000000', 'AIA Financial',          'insurance', 'INS-2017-055', 'Jl. Prajurit KKO No. 1, Jakarta Utara',     true, NOW()),
  ('22222222-0004-0000-0000-000000000000', 'Manulife Indonesia',     'insurance', 'INS-2015-013', 'Jl. Pegangsaan Timur No. 1A, Jakarta',      true, NOW()),
  ('22222222-0005-0000-0000-000000000000', 'Allianz Life Indonesia', 'insurance', 'INS-2019-031', 'Jl. TB Simatupang No. 5, Jakarta Selatan',  true, NOW()),
  ('22222222-0006-0000-0000-000000000000', 'BNI Life Insurance',     'insurance', 'INS-2020-044', 'Jl. Jenderal Sudirman Kav. 1, Jakarta',     true, NOW()),
  ('22222222-0007-0000-0000-000000000000', 'BPJS Kesehatan',         'insurance', 'INS-2014-002', 'Jl. Letjen Suprapto No. 20, Jakarta Pusat', true, NOW()),
  ('22222222-0008-0000-0000-000000000000', 'Cigna Indonesia',        'insurance', 'INS-2021-018', 'Jl. Gatot Subroto No. 42, Jakarta',         true, NOW()),
  ('22222222-0009-0000-0000-000000000000', 'Sun Life Indonesia',     'insurance', 'INS-2018-066', 'Jl. Prof. Dr. Satrio Kav. 18, Jakarta',     true, NOW()),
  ('22222222-0010-0000-0000-000000000000', 'Great Eastern Life',     'insurance', 'INS-2022-011', 'Jl. H.R. Rasuna Said Kav. B4, Jakarta',     true, NOW())

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- RINGKASAN: 20 institutions
--   Hospital  (10): 11111111-0001 s/d 11111111-0010
--   Insurance (10): 22222222-0001 s/d 22222222-0010
-- =============================================================================
