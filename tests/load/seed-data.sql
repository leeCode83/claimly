-- ============================================================
-- LOAD TESTING SEED DATA
-- Claimly Backend Load Test Preparation
-- ============================================================
-- Usage:
--   docker exec -i claimly-db psql -U postgres -d postgres < tests/load/seed-data.sql
-- Or via Supabase CLI:
--   psql $DATABASE_URL < tests/load/seed-data.sql
-- ============================================================

-- Start fresh (optional - comment out if you want to keep existing data)
TRUNCATE institutions, users, patients, insurance_policies, patient_policies,
         diagnoses, procedures, medical_records, claims, zkp_proofs,
         policy_covered_diagnoses, policy_covered_procedures, audit_logs
         CASCADE;

-- ============================================================
-- 1. INSTITUTIONS
-- ============================================================

-- Hospital institutions
INSERT INTO institutions (id, name, type, license_number, address, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'RS Umum Pusat Jakarta', 'hospital', 'HOSP-001-JK', 'Jl. Sudirman No. 1, Jakarta', true),
('22222222-2222-2222-2222-222222222222', 'RS一字 Medical Center', 'hospital', 'HOSP-002-JK', 'Jl. Thamrin No. 2, Jakarta', true),
('33333333-3333-3333-3333-333333333333', 'RS一字 Surabaya', 'hospital', 'HOSP-003-SB', 'Jl. Pemuda No. 3, Surabaya', true),
('44444444-4444-4444-4444-444444444444', 'RS一字 Bandung', 'hospital', 'HOSP-004-BD', 'Jl. Asia Afrika No. 4, Bandung', true);

-- Insurance institutions
INSERT INTO institutions (id, name, type, license_number, address, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Asuransi Kesehatan Indonesia', 'insurance', 'INS-001-2024', 'Jl. Gatot Subroto No. 10, Jakarta', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Asuransi Sinarmas', 'insurance', 'INS-002-2024', 'Jl. Sudirman No. 50, Jakarta', true);

-- ============================================================
-- 2. USERS
-- ============================================================

-- Hospital staff users (linked to hospital institutions)
INSERT INTO users (id, full_name, role, institution_id) VALUES
('a1111111-1111-1111-1111-111111111111', 'Dr. Sarah Wijaya', 'hospital_staff', '11111111-1111-1111-1111-111111111111'),
('a2222222-2222-2222-2222-222222222222', 'Dr. Ahmad Hidayat', 'hospital_staff', '22222222-2222-2222-2222-222222222222'),
('a3333333-3333-3333-3333-333333333333', 'Dr. Maria Chen', 'hospital_staff', '33333333-3333-3333-3333-333333333333'),
('a4444444-4444-4444-4444-444444444444', 'Dr. Budi Santoso', 'hospital_staff', '44444444-4444-4444-4444-444444444444');

-- Insurance reviewer users (linked to insurance institutions)
INSERT INTO users (id, full_name, role, institution_id) VALUES
('b1111111-1111-1111-1111-111111111111', ' reviewer Andi Prasetyo', 'insurance_reviewer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('b2222222-2222-2222-2222-222222222222', 'Reviewer Dina Fortuna', 'insurance_reviewer', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('b3333333-3333-3333-3333-333333333333', 'Reviewer Garry Hermawan', 'insurance_reviewer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Patient users (no institution link - they are individuals)
INSERT INTO users (id, full_name, role, institution_id) VALUES
('c1111111-1111-1111-1111-111111111111', 'John Doe', 'patient', NULL),
('c2222222-2222-2222-2222-222222222222', 'Jane Smith', 'patient', NULL),
('c3333333-3333-3333-3333-333333333333', 'Robert Tan', 'patient', NULL),
('c4444444-4444-4444-4444-444444444444', 'Lina Hartono', 'patient', NULL),
('c5555555-5555-5555-5555-555555555555', 'Michael Wijaya', 'patient', NULL),
('c6666666-6666-6666-6666-666666666666', 'Siti Nurhaliza', 'patient', NULL),
('c7777777-7777-7777-7777-777777777777', 'David Lee', 'patient', NULL),
('c8888888-8888-8888-8888-888888888888', 'Emma Santoso', 'patient', NULL),
('c9999999-9999-9999-9999-999999999999', 'Frank Chen', 'patient', NULL),
('ca000000-0000-0000-0000-000000000000', 'Grace Tanoto', 'patient', NULL);

-- Admin user
INSERT INTO users (id, full_name, role, institution_id) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'System Administrator', 'admin', NULL);

-- ============================================================
-- 3. DIAGNOSES (ICD-10 Codes)
-- ============================================================

INSERT INTO diagnoses (id, icd10_code, icd10_integer_encoding, description, category) VALUES
(gen_random_uuid(), 'A00', 1000000, 'Kolera', 'Infectious Diseases'),
(gen_random_uuid(), 'A01', 1000100, 'Tifoid dan paratifoid', 'Infectious Diseases'),
(gen_random_uuid(), 'A02', 1000200, 'Keracunan makanan oleh Salmonella', 'Infectious Diseases'),
(gen_random_uuid(), 'A09', 1000900, 'Diare dan gastroenteritis怀疑 infeksius', 'Infectious Diseases'),
(gen_random_uuid(), 'B00', 2000000, 'Infeksi herpesvirus', 'Viral Infections'),
(gen_random_uuid(), 'B01', 2000100, 'Varicella (cacar air)', 'Viral Infections'),
(gen_random_uuid(), 'B02', 2000200, 'Herpes zoster', 'Viral Infections'),
(gen_random_uuid(), 'B30', 2003000, 'Konjungtivitisvirus', 'Viral Infections'),
(gen_random_uuid(), 'C00', 3000000, 'Neoplasma ganas bibir, rongga mulut dan faring', 'Neoplasms'),
(gen_random_uuid(), 'C18', 3018000, 'Neoplasma ganas kolon', 'Neoplasms'),
(gen_random_uuid(), 'C34', 3034000, 'Neoplasma ganas bronkus dan paru', 'Neoplasms'),
(gen_random_uuid(), 'C50', 3050000, 'Neoplasma ganas mammae', 'Neoplasms'),
(gen_random_uuid(), 'C61', 3061000, 'Neoplasma ganas kelenjar prostat', 'Neoplasms'),
(gen_random_uuid(), 'D17', 4017000, 'Neoplasma jinak lemak', 'Non-malignant'),
(gen_random_uuid(), 'E10', 5010000, 'Diabetes mellitus insulin-dependent', 'Endocrine'),
(gen_random_uuid(), 'E11', 5011000, 'Diabetes mellitus non-insulin-dependent', 'Endocrine'),
(gen_random_uuid(), 'E14', 5014000, 'Diabetes mellitus yang tidak terspesifikasi', 'Endocrine'),
(gen_random_uuid(), 'F32', 6032000, 'Episod depresif berat', 'Mental Disorders'),
(gen_random_uuid(), 'F41', 6041000, 'Gangguan panik', 'Mental Disorders'),
(gen_random_uuid(), 'F43', 6043000, 'Reaksi terhadap stres berat', 'Mental Disorders'),
(gen_random_uuid(), 'G40', 7040000, 'Epilepsi', 'Neurological'),
(gen_random_uuid(), 'G43', 7043000, 'Migrain', 'Neurological'),
(gen_random_uuid(), 'H10', 8100000, 'Konjungtivitis', 'Eye Diseases'),
(gen_random_uuid(), 'H25', 8125000, ' Katarak age-related', 'Eye Diseases'),
(gen_random_uuid(), 'I10', 9100000, 'Hipertensi esensial', 'Cardiovascular'),
(gen_random_uuid(), 'I20', 9200000, 'Angina pektoris', 'Cardiovascular'),
(gen_random_uuid(), 'I21', 9201000, 'Infark miokardium akut', 'Cardiovascular'),
(gen_random_uuid(), 'I25', 9205000, 'Penyakit jantung iskemik kronis', 'Cardiovascular'),
(gen_random_uuid(), 'I50', 9500000, 'Gagal jantung', 'Cardiovascular'),
(gen_random_uuid(), 'J00', 10000000, 'Nasofaringitis akut', 'Respiratory'),
(gen_random_uuid(), 'J02', 10002000, 'Faringitis akut', 'Respiratory'),
(gen_random_uuid(), 'J03', 10003000, 'Tonsilitis akut', 'Respiratory'),
(gen_random_uuid(), 'J18', 10018000, 'Pneumonia, organisme yang tidak spesifik', 'Respiratory'),
(gen_random_uuid(), 'J44', 10044000, 'Penyakit paru obstruktif kronis', 'Respiratory'),
(gen_random_uuid(), 'K00', 11000000, 'Gangguan development gigi', 'Digestive'),
(gen_random_uuid(), 'K02', 11002000, 'Karies gigi', 'Digestive'),
(gen_random_uuid(), 'K04', 11004000, 'Penyakit jaringan keras gigi', 'Digestive'),
(gen_random_uuid(), 'K08', 11008000, 'Gangguan lain gigi', 'Digestive'),
(gen_random_uuid(), 'K25', 11025000, 'Tukaklambung', 'Digestive'),
(gen_random_uuid(), 'K29', 11029000, 'Gastritis dan duodenitis', 'Digestive'),
(gen_random_uuid(), 'K35', 11035000, 'Apendisitis akut', 'Digestive'),
(gen_random_uuid(), 'K40', 11040000, 'Hernia inguinal', 'Digestive'),
(gen_random_uuid(), 'K50', 11050000, 'Penyakit Crohn', 'Digestive'),
(gen_random_uuid(), 'K51', 11051000, 'Kolitis ulseratif', 'Digestive'),
(gen_random_uuid(), 'K52', 11052000, 'Kolitis dan gastroenteritis non-infeksius lain', 'Digestive'),
(gen_random_uuid(), 'K70', 11070000, 'Penyakit alkoholik hati', 'Digestive'),
(gen_random_uuid(), 'K76', 11076000, 'Penyakit lain hati', 'Digestive'),
(gen_random_uuid(), 'L20', 12002000, ' dermatitis atopik', 'Skin'),
(gen_random_uuid(), 'L30', 12003000, 'Dermatitis lain', 'Skin'),
(gen_random_uuid(), 'L40', 12004000, 'Psoriasis', 'Skin'),
(gen_random_uuid(), 'M05', 13005000, 'Artritis reumatoid seropositif', 'Musculoskeletal'),
(gen_random_uuid(), 'M10', 13100000, 'Pirai', 'Musculoskeletal'),
(gen_random_uuid(), 'M15', 13150000, 'Poliartrosis', 'Musculoskeletal'),
(gen_random_uuid(), 'M17', 13170000, 'Osteoartritis gonartrosis', 'Musculoskeletal'),
(gen_random_uuid(), 'M54', 13540000, 'Nyeri punggung bawah', 'Musculoskeletal'),
(gen_random_uuid(), 'N18', 14180000, 'Penyakit ginjal kronis', 'Genitourinary'),
(gen_random_uuid(), 'N20', 14200000, 'Batu ginjal dan ureter', 'Genitourinary'),
(gen_random_uuid(), 'N39', 14390000, 'Gangguan saluran kemih lain', 'Genitourinary'),
(gen_random_uuid(), 'N40', 14400000, 'Hiperplasia prostat', 'Genitourinary'),
(gen_random_uuid(), 'O00', 15000000, 'Kehamilan ektopik', 'Pregnancy'),
(gen_random_uuid(), 'O03', 15003000, 'Abortus spontan', 'Pregnancy'),
(gen_random_uuid(), 'O10', 15100000, 'Hipertensi yang sudah ada yang memperburuk', 'Pregnancy'),
(gen_random_uuid(), 'O14', 15140000, 'Pre-eklampsia berat', 'Pregnancy'),
(gen_random_uuid(), 'O80', 15800000, 'Persalinan tunggal spontan', 'Pregnancy'),
(gen_random_uuid(), 'R05', 18005000, 'Batuk', 'Symptoms'),
(gen_random_uuid(), 'R10', 18100000, 'Nyeri perut dan panggul', 'Symptoms'),
(gen_random_uuid(), 'R50', 18500000, 'Demam上还', 'Symptoms'),
(gen_random_uuid(), 'R51', 18510000, 'Sakit kepala', 'Symptoms'),
(gen_random_uuid(), 'S00', 19000000, 'Cedera superfisial kepala', 'Injuries'),
(gen_random_uuid(), 'S42', 19420000, 'Fraktur bahu dan lengan atas', 'Injuries'),
(gen_random_uuid(), 'S62', 19620000, 'Fraktur pergelangan tangan dan tangan', 'Injuries'),
(gen_random_uuid(), 'S72', 19720000, 'Fraktur femur', 'Injuries'),
(gen_random_uuid(), 'S82', 19820000, 'Fraktur kaki', 'Injuries'),
(gen_random_uuid(), 'T78', 20078000, 'Efek samping yang tidak klasik', 'Injury');

-- ============================================================
-- 4. PROCEDURES (ICD-9-CM Codes)
-- ============================================================

INSERT INTO procedures (id, icd9_code, icd9_integer_encoding, description, default_max_coverage, valid_diagnosis_encodings) VALUES
(gen_random_uuid(), '01.0', 1000000, 'Prosedur cerebrospinal', 5000000, ARRAY[7040000, 7043000]),
(gen_random_uuid(), '01.2', 1002000, 'Prosedur diagnostik pada otak danSSP', 4500000, ARRAY[7040000, 7043000, 3034000]),
(gen_random_uuid(), '01.6', 1006000, 'Prosedur pada otak danSSP lain', 6000000, ARRAY[7040000, 7043000]),
(gen_random_uuid(), '03.0', 3000000, 'Myelotomi dan prosedurnya', 4000000, ARRAY[7040000]),
(gen_random_uuid(), '03.3', 3003000, 'Prosedur diagnostik pada tulang belakang', 3500000, ARRAY[7040000, 13540000]),
(gen_random_uuid(), '04.0', 4000000, 'Persschnitt dan eksisi saraf', 2500000, ARRAY[7043000, 7040000]),
(gen_random_uuid(), '04.2', 4002000, 'Destruksi nervus kranialis', 2800000, ARRAY[7043000]),
(gen_random_uuid(), '04.4', 4004000, 'Prosedur kompresi pada nervus', 2000000, ARRAY[7043000]),
(gen_random_uuid(), '04.6', 4006000, 'Penjahitan saraf', 2200000, ARRAY[7040000]),
(gen_random_uuid(), '05.0', 5000000, 'Persschnitt dan eksisi pada kelenjar endoskrina', 3500000, ARRAY[5010000, 5014000]),
(gen_random_uuid(), '06.0', 6000000, 'Persschnitt dan eksisi tiroid', 4500000, ARRAY[5010000, 5014000]),
(gen_random_uuid(), '06.2', 6002000, 'Lobektomi tiroid parsial', 5000000, ARRAY[5010000]),
(gen_random_uuid(), '06.9', 6009000, 'Tiroidektomi lain', 5500000, ARRAY[5010000, 5014000]),
(gen_random_uuid(), '07.0', 7000000, 'Persschnitt kelenjar hipofisis', 6000000, ARRAY[5010000]),
(gen_random_uuid(), '07.6', 7006000, 'Prosedur pada kelenjar hipofisis lain', 6500000, ARRAY[5010000]),
(gen_random_uuid(), '31.1', 3110000, 'Laringektomi parsial', 7000000, ARRAY[3034000]),
(gen_random_uuid(), '31.2', 3120000, 'Laringektomi radikal', 8500000, ARRAY[3034000]),
(gen_random_uuid(), '32.0', 3200000, 'Reseksi lokal paru-paru', 8000000, ARRAY[3034000, 10018000]),
(gen_random_uuid(), '32.3', 3203000, 'Segmentektomi paru', 7500000, ARRAY[3034000]),
(gen_random_uuid(), '32.4', 3204000, 'Lobektomi paru', 9000000, ARRAY[3034000]),
(gen_random_uuid(), '32.5', 3205000, 'Pneumonektomi', 12000000, ARRAY[3034000]),
(gen_random_uuid(), '33.1', 3310000, 'Insisi paru-paru', 5000000, ARRAY[10018000, 10044000]),
(gen_random_uuid(), '33.2', 3320000, 'Prosedur diagnostik pada paru-paru', 4000000, ARRAY[3034000, 10018000]),
(gen_random_uuid(), '33.5', 3350000, 'Prosedur destruktif pada paru-paru', 5500000, ARRAY[3034000]),
(gen_random_uuid(), '34.0', 3400000, 'Torakotomi', 6000000, ARRAY[3034000, 10018000, 10044000]),
(gen_random_uuid(), '34.2', 3420000, 'Pleurodesis', 4500000, ARRAY[10044000]),
(gen_random_uuid(), '34.4', 3440000, 'Prosedur untuk deflasi pleural', 3500000, ARRAY[10044000]),
(gen_random_uuid(), '34.6', 3460000, 'Perssection pada diafragma', 4000000, ARRAY[10044000]),
(gen_random_uuid(), '37.1', 3710000, 'Perikardiosentesis', 3000000, ARRAY[9200000, 9201000, 9500000]),
(gen_random_uuid(), '37.2', 3720000, 'Prosedur diagnostik pada perikardium', 3500000, ARRAY[9500000]),
(gen_random_uuid(), '37.3', 3730000, 'Perssection dan eksisi lesion jantung', 8000000, ARRAY[9201000, 9500000]),
(gen_random_uuid(), '37.4', 3740000, 'Reparasi dan prosedur pada katup jantung', 15000000, ARRAY[9201000, 9500000]),
(gen_random_uuid(), '37.5', 3750000, 'Prosedur pada otot jantung', 12000000, ARRAY[9201000, 9500000]),
(gen_random_uuid(), '38.0', 3800000, 'Insisi pada pembuluh darah', 3000000, ARRAY[9200000, 9201000, 9205000]),
(gen_random_uuid(), '38.1', 3810000, 'Prosedur diagnostik pada pembuluh darah', 4000000, ARRAY[9200000, 9205000]),
(gen_random_uuid(), '38.2', 3820000, 'Ekstirpasi lesion pada pembuluh darah', 5500000, ARRAY[9205000]),
(gen_random_uuid(), '38.3', 3830000, 'Angpektomi', 7000000, ARRAY[9205000]),
(gen_random_uuid(), '38.4', 3840000, 'Prosedur lain pada pembuluh darah', 5000000, ARRAY[9200000, 9205000]),
(gen_random_uuid(), '38.9', 3890000, 'Kateterisasi vena', 2000000, ARRAY[9200000, 9500000]),
(gen_random_uuid(), '39.0', 3900000, 'Operasi bypass kardiovaskular', 20000000, ARRAY[9201000, 9205000]),
(gen_random_uuid(), '39.2', 3920000, 'Shunting vascular', 8500000, ARRAY[9205000]),
(gen_random_uuid(), '39.5', 3950000, 'Oklusi endovaskular', 9000000, ARRAY[9200000, 9201000]),
(gen_random_uuid(), '39.6', 3960000, 'Dilatasi endovaskular koroner perkutan', 12000000, ARRAY[9201000]),
(gen_random_uuid(), '39.7', 3970000, 'Implantasi stent koroner', 15000000, ARRAY[9201000]),
(gen_random_uuid(), '39.9', 3990000, 'Prosedur lain pada jantung dan pembuluh darah', 7000000, ARRAY[9200000, 9500000]),
(gen_random_uuid(), '40.1', 4010000, 'Insisi pada saluran limfe', 2500000, ARRAY[3050000]),
(gen_random_uuid(), '40.2', 4020000, 'Prosedur diagnostik pada sistem limfe', 3000000, ARRAY[3050000]),
(gen_random_uuid(), '40.3', 4030000, 'Ekstirpasi lesion pada saluran limfe', 3500000, ARRAY[3050000]),
(gen_random_uuid(), '40.4', 4040000, 'Prosedur eksisi pada kelenjar getah bening', 4000000, ARRAY[3050000, 3034000]),
(gen_random_uuid(), '41.0', 4100000, 'Splenektomi', 5500000, ARRAY[11070000]),
(gen_random_uuid(), '41.2', 4120000, 'Prosedur diagnostik pada limpa', 3000000, ARRAY[11070000]),
(gen_random_uuid(), '42.0', 4200000, 'Insisi pada esophagus', 4000000, ARRAY[3034000]),
(gen_random_uuid(), '42.1', 4210000, 'Esofagogastroskopi', 2500000, ARRAY[11025000, 11029000]),
(gen_random_uuid(), '42.2', 4220000, 'Perssection dan eksisi lesion pada esophagus', 5000000, ARRAY[3034000]),
(gen_random_uuid(), '42.3', 4230000, 'Esofagogastrostomi', 6000000, ARRAY[11025000]),
(gen_random_uuid(), '42.4', 4240000, 'Reparasi hernia hiatal', 6500000, ARRAY[11025000]),
(gen_random_uuid(), '42.5', 4250000, 'Prosedur pembentukkan pada esophagus', 7000000, ARRAY[3034000]),
(gen_random_uuid(), '43.0', 4300000, 'Insisi abdomen', 3500000, ARRAY[11035000, 11040000]),
(gen_random_uuid(), '43.1', 4310000, 'Gastrektomi parsial', 8000000, ARRAY[3034000]),
(gen_random_uuid(), '43.2', 4320000, 'Gastrektomi subtotal', 8500000, ARRAY[3034000]),
(gen_random_uuid(), '43.3', 4330000, 'Gastrektomi total', 10000000, ARRAY[3034000]),
(gen_random_uuid(), '43.4', 4340000, 'Piloroantrumektomi', 7500000, ARRAY[11025000]),
(gen_random_uuid(), '43.5', 4350000, ' gastroenterosotomi lain', 6000000, ARRAY[11025000, 11029000]),
(gen_random_uuid(), '43.6', 4360000, 'Perssection pylorus', 5000000, ARRAY[11025000]),
(gen_random_uuid(), '43.7', 4370000, 'Piloroplasti', 4500000, ARRAY[11025000]),
(gen_random_uuid(), '43.8', 4380000, 'Prosedur lain pada lambung', 5500000, ARRAY[11025000]),
(gen_random_uuid(), '43.9', 4390000, 'Prosedur lain pada saluran cerna', 5000000, ARRAY[11025000, 11029000]),
(gen_random_uuid(), '44.0', 4400000, 'Duodenotomi', 3500000, ARRAY[11029000]),
(gen_random_uuid(), '44.1', 4410000, 'Gastrotomi', 3000000, ARRAY[11025000]),
(gen_random_uuid(), '44.2', 4420000, 'Prosedur diagnostik pada lambung', 2500000, ARRAY[11025000]),
(gen_random_uuid(), '44.3', 4430000, 'Perssection lesion pada lambung', 4000000, ARRAY[3034000]),
(gen_random_uuid(), '44.4', 4440000, 'Prosedur destruktif pada lambung', 4500000, ARRAY[3034000]),
(gen_random_uuid(), '44.5', 4450000, 'Varsus dari lambung', 5000000, ARRAY[11025000]),
(gen_random_uuid(), '44.6', 4460000, 'Sutur lambung', 4000000, ARRAY[11035000]),
(gen_random_uuid(), '44.7', 4470000, 'Prosedur lain pada lambung', 4500000, ARRAY[11025000]),
(gen_random_uuid(), '44.9', 4490000, 'Prosedur lain pada duodenum', 3500000, ARRAY[11029000]),
(gen_random_uuid(), '45.0', 4500000, 'Insisi usus', 3500000, ARRAY[11035000, 11050000]),
(gen_random_uuid(), '45.1', 4510000, 'Duodenum dan intestin halus', 4000000, ARRAY[11025000, 11050000]),
(gen_random_uuid(), '45.2', 4520000, 'Perssection lesion pada intestin', 5000000, ARRAY[11050000, 11051000]),
(gen_random_uuid(), '45.3', 4530000, 'Hemikolektomi kanan', 7500000, ARRAY[3018000, 11052000]),
(gen_random_uuid(), '45.4', 4540000, 'Hemikolektomi kiri', 7500000, ARRAY[3018000, 11051000]),
(gen_random_uuid(), '45.5', 4550000, 'Kolektomi transversus', 7000000, ARRAY[3018000, 11051000]),
(gen_random_uuid(), '45.6', 4560000, 'Kolektomi lain', 8000000, ARRAY[3018000, 11050000, 11051000]),
(gen_random_uuid(), '45.7', 4570000, 'Proktokolektomi total', 12000000, ARRAY[11051000]),
(gen_random_uuid(), '45.8', 4580000, ' Kolostomi其它', 5000000, ARRAY[11051000]),
(gen_random_uuid(), '45.9', 4590000, 'Prosedur lain pada intestin', 4500000, ARRAY[11050000, 11052000]),
(gen_random_uuid(), '46.0', 4600000, 'Insisi peritoneum', 3000000, ARRAY[11035000]),
(gen_random_uuid(), '46.1', 4610000, 'Duodenum dan peritoneum', 4000000, ARRAY[11029000]),
(gen_random_uuid(), '46.2', 4620000, 'Perssection lesion pada peritoneum', 4500000, ARRAY[11052000]),
(gen_random_uuid(), '46.3', 4630000, 'Prosedur pada mesenterium', 3500000, ARRAY[3018000]),
(gen_random_uuid(), '46.4', 4640000, 'Prosedur pada omentum', 3000000, ARRAY[11052000]),
(gen_random_uuid(), '46.5', 4650000, 'Prosedur pada peritoneum lain', 3500000, ARRAY[11035000]),
(gen_random_uuid(), '47.0', 4700000, 'Appendektomi', 4000000, ARRAY[11035000]),
(gen_random_uuid(), '47.1', 4710000, 'Laparoskopi appendektomi', 4500000, ARRAY[11035000]),
(gen_random_uuid(), '47.2', 4720000, 'Appendektomi残其他', 4000000, ARRAY[11035000]),
(gen_random_uuid(), '48.0', 4800000, 'Insisi dan eksisi pada rektum', 4000000, ARRAY[11051000]),
(gen_random_uuid(), '48.1', 4810000, 'Prosedur diagnostik pada rektum', 3500000, ARRAY[11051000]),
(gen_random_uuid(), '48.2', 4820000, 'Perssection lesion pada rektum', 5000000, ARRAY[11051000]),
(gen_random_uuid(), '48.3', 4830000, 'Pull-through prosedurnya', 6500000, ARRAY[11051000]),
(gen_random_uuid(), '48.4', 4840000, 'Reparasi rektum其他', 5500000, ARRAY[11051000]),
(gen_random_uuid(), '48.5', 4850000, 'Abdominoperineal resection', 9000000, ARRAY[3018000]),
(gen_random_uuid(), '48.6', 4860000, 'Reseksi rektum lainnya', 7500000, ARRAY[11051000]),
(gen_random_uuid(), '49.0', 4900000, 'Insisi perianal', 2000000, ARRAY[11052000]),
(gen_random_uuid(), '49.1', 4910000, 'Prosedur diagnostik pada anus', 2500000, ARRAY[11052000]),
(gen_random_uuid(), '49.2', 4920000, 'Perssection lesion pada anus', 3000000, ARRAY[11052000]),
(gen_random_uuid(), '49.3', 4930000, 'Perssection fistula perianal', 3500000, ARRAY[11052000]),
(gen_random_uuid(), '49.4', 4940000, 'Prosedur untuk wasir', 2500000, ARRAY[11052000]),
(gen_random_uuid(), '49.5', 4950000, 'Sphincterotomi anal', 3000000, ARRAY[11052000]),
(gen_random_uuid(), '49.6', 4960000, 'Prosedur pada anus lainnya', 2500000, ARRAY[11052000]),
(gen_random_uuid(), '51.0', 5100000, 'Perssection dan destruksi pada kandung empedu', 4500000, ARRAY[11076000]),
(gen_random_uuid(), '51.1', 5110000, 'Kolesistektomi', 5500000, ARRAY[11076000]),
(gen_random_uuid(), '51.2', 5120000, 'Kolesistostomi', 3500000, ARRAY[11076000]),
(gen_random_uuid(), '51.3', 5130000, 'Prosedur diagnostik pada kandung empedu', 3000000, ARRAY[11076000]),
(gen_random_uuid(), '51.4', 5140000, 'Prosedur lain pada kandung empedu', 4000000, ARRAY[11076000]),
(gen_random_uuid(), '51.5', 5150000, 'Common bile duct exploration', 5500000, ARRAY[11076000]),
(gen_random_uuid(), '51.6', 5160000, 'Prosedur lain pada saluran empedu', 5000000, ARRAY[11076000]),
(gen_random_uuid(), '52.0', 5200000, 'Hepatektomi parsial', 7500000, ARRAY[11076000]),
(gen_random_uuid(), '52.2', 5220000, 'Lobektomi hati', 10000000, ARRAY[3034000, 11076000]),
(gen_random_uuid(), '52.3', 5230000, 'Hepatektomi lainnya', 8500000, ARRAY[11076000]),
(gen_random_uuid(), '52.5', 5250000, 'Liver transplantasi', 50000000, ARRAY[11076000]),
(gen_random_uuid(), '52.6', 5260000, 'Prosedur diagnostik pada hati', 4000000, ARRAY[11076000, 11070000]),
(gen_random_uuid(), '52.7', 5270000, 'Prosedur lainnya pada hati', 6000000, ARRAY[11076000]),
(gen_random_uuid(), '53.0', 5300000, 'Perssection pada hernia inguinal', 4000000, ARRAY[11040000]),
(gen_random_uuid(), '53.1', 5310000, 'Repair hernia inguinal langsung', 4500000, ARRAY[11040000]),
(gen_random_uuid(), '53.2', 5320000, 'Repair hernia inguinal dengan graft', 5000000, ARRAY[11040000]),
(gen_random_uuid(), '53.3', 5330000, 'Repair hernia femoral', 4500000, ARRAY[11040000]),
(gen_random_uuid(), '53.4', 5340000, 'Repair hernia lainnya', 4000000, ARRAY[11040000]),
(gen_random_uuid(), '53.5', 5350000, 'Hernia repair dengan graft atau prosthesis', 5500000, ARRAY[11040000]),
(gen_random_uuid(), '53.6', 5360000, 'Hernia repair lainnya', 4500000, ARRAY[11040000]),
(gen_random_uuid(), '54.0', 5400000, 'Insisi dinding abdomen', 3500000, ARRAY[11035000]),
(gen_random_uuid(), '54.1', 5410000, 'Laparotomi eksplorasi', 4500000, ARRAY[11035000, 11050000]),
(gen_random_uuid(), '54.2', 5420000, 'Laparoskopi', 4000000, ARRAY[11035000]),
(gen_random_uuid(), '54.3', 5430000, 'Perssection adhesiolisis', 5000000, ARRAY[11035000]),
(gen_random_uuid(), '54.4', 5440000, 'Prosedur pada mesenterium', 4000000, ARRAY[3018000]),
(gen_random_uuid(), '54.5', 5450000, 'Laparoskopi other', 4500000, ARRAY[11035000]),
(gen_random_uuid(), '54.6', 5460000, 'Laparotomi other', 4000000, ARRAY[11035000]),
(gen_random_uuid(), '54.7', 5470000, 'Perssection peritoneum other', 3500000, ARRAY[11035000]),
(gen_random_uuid(), '54.8', 5480000, 'Laparoskopi with biopsy', 4000000, ARRAY[3018000]),
(gen_random_uuid(), '54.9', 5490000, 'Prosedur other pada peritoneal cavity', 3500000, ARRAY[11035000]),
(gen_random_uuid(), '55.0', 5500000, 'Nefrektomi parsial', 6500000, ARRAY[14180000]),
(gen_random_uuid(), '55.1', 5510000, 'Nefrektomi radikal', 8500000, ARRAY[14180000, 14200000]),
(gen_random_uuid(), '55.2', 5520000, 'Nefrektomi lainnya', 7000000, ARRAY[14200000]),
(gen_random_uuid(), '55.3', 5530000, 'Nefrostomi dan pyelostomi', 4000000, ARRAY[14200000]),
(gen_random_uuid(), '55.4', 5540000, 'Perssection pelvis ginjal', 5000000, ARRAY[14200000]),
(gen_random_uuid(), '55.5', 5550000, 'Prosedur diagnostik pada ginjal dan pelvis', 3500000, ARRAY[14180000]),
(gen_random_uuid(), '55.6', 5560000, 'Nefrolitotomi atau nefrolitogenesis', 5500000, ARRAY[14200000]),
(gen_random_uuid(), '55.7', 5570000, 'Nefropeksi', 4500000, ARRAY[14180000]),
(gen_random_uuid(), '55.9', 5590000, 'Prosedur lain pada ginjal', 4000000, ARRAY[14180000]),
(gen_random_uuid(), '56.0', 5600000, 'Transurethral ureterolithotripsy', 4500000, ARRAY[14200000]),
(gen_random_uuid(), '56.1', 5610000, 'Ureterolithotomi', 5000000, ARRAY[14200000]),
(gen_random_uuid(), '56.2', 5620000, 'Ureterektomi parsial', 4500000, ARRAY[14200000]),
(gen_random_uuid(), '56.3', 5630000, 'Ureteroureterostomy', 5000000, ARRAY[14200000]),
(gen_random_uuid(), '56.4', 5640000, 'Ureterneocystostomy', 5500000, ARRAY[14200000]),
(gen_random_uuid(), '56.5', 5650000, 'Ureterolysis', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '56.6', 5660000, 'Ureterektomi other', 5000000, ARRAY[14200000]),
(gen_random_uuid(), '56.7', 5670000, 'Ureteroplasti', 5500000, ARRAY[14200000]),
(gen_random_uuid(), '56.8', 5680000, 'Perssection pada ureter', 4500000, ARRAY[14200000]),
(gen_random_uuid(), '56.9', 5690000, 'Prosedur lain pada ureter', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '57.0', 5700000, 'Transurethral cystectomy', 6500000, ARRAY[14390000]),
(gen_random_uuid(), '57.1', 5710000, 'Urachotomy', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '57.2', 5720000, 'Cystostomi', 3000000, ARRAY[14390000]),
(gen_random_uuid(), '57.3', 5730000, 'Perssection lesion pada kandung kemih', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '57.4', 5740000, 'Divertikulektomi kandung kemih', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '57.5', 5750000, 'Cystektomi partial', 5500000, ARRAY[14390000]),
(gen_random_uuid(), '57.6', 5760000, 'Cystektomi radikal', 10000000, ARRAY[14390000]),
(gen_random_uuid(), '57.7', 5770000, 'Ureterosigmoidostomy', 6000000, ARRAY[14390000]),
(gen_random_uuid(), '57.8', 5780000, 'Urinary diversion other', 7000000, ARRAY[14390000]),
(gen_random_uuid(), '57.9', 5790000, 'Prosedur lain pada kandung kemih', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '60.0', 6000000, 'Transurethral prostatectomy', 5500000, ARRAY[14400000]),
(gen_random_uuid(), '60.1', 6010000, 'Transurethral (segmental) prostatectomy', 6000000, ARRAY[14400000]),
(gen_random_uuid(), '60.2', 6020000, 'Transurethral prostatectomy残的其他', 5500000, ARRAY[14400000]),
(gen_random_uuid(), '60.3', 6030000, 'Suprapubic prostatectomy', 6500000, ARRAY[14400000]),
(gen_random_uuid(), '60.4', 6040000, 'Retropubic prostatectomy', 7000000, ARRAY[14400000]),
(gen_random_uuid(), '60.5', 6050000, 'Radical prostatectomy', 8500000, ARRAY[14400000]),
(gen_random_uuid(), '60.6', 6060000, 'Prostatectomy other', 6000000, ARRAY[14400000]),
(gen_random_uuid(), '60.7', 6070000, 'Operations on seminal vesicle', 5000000, ARRAY[14400000]),
(gen_random_uuid(), '60.8', 6080000, 'Incision and drainage of prostate', 3500000, ARRAY[14400000]),
(gen_random_uuid(), '60.9', 6090000, 'Operations on prostate other', 4500000, ARRAY[14400000]),
(gen_random_uuid(), '64.0', 6400000, 'Transurethral removal of obstruction', 4000000, ARRAY[14400000]),
(gen_random_uuid(), '64.1', 6410000, 'Urethrotomy', 3000000, ARRAY[14390000]),
(gen_random_uuid(), '64.2', 6420000, 'Perssection urethral stricture', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '64.3', 6430000, 'Repair urethral stricture', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '64.4', 6440000, 'Urethral meatotomy', 2500000, ARRAY[14390000]),
(gen_random_uuid(), '64.5', 6450000, 'Other urethrotomy', 3000000, ARRAY[14390000]),
(gen_random_uuid(), '64.6', 6460000, 'Closure of urethrostomy', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '64.7', 6470000, 'Repair of hypospadias or epispadias', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '64.8', 6480000, 'Other repair of urethra', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '64.9', 6490000, 'Operations on urethra other', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '65.0', 6500000, 'Oophorectomy unilateral', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '65.1', 6510000, 'Partial oophorectomy', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '65.2', 6520000, 'Oophorectomy lainnya', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '65.3', 6530000, 'Laparoscopic unilateral oophorectomy', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '65.4', 6540000, 'Laparoscopic partial oophorectomy', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '65.5', 6550000, 'Laparoscopic oophorectomy lainnya', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '65.6', 6560000, 'Other oophorectomy', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '65.7', 6570000, 'Repair of ovary', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '65.8', 6580000, 'Laparoscopic oophoroplasty', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '65.9', 6590000, 'Other operations on ovary', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '66.0', 6600000, 'Salpingectomy uni/bilateral', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '66.1', 6610000, 'Perssection lesion pada tuba falopi', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '66.2', 6620000, 'Salpingotomy dan salpingostomy', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '66.3', 6630000, 'Salpingostomy', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '66.4', 6640000, 'Perssection adhesiolisis tuba falopi', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '66.5', 6650000, 'Prosedur diagnostik pada tuba falopi', 3000000, ARRAY[14390000]),
(gen_random_uuid(), '66.6', 6660000, 'BD tuba falopi其他的Perssection', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '66.7', 6670000, 'Tuboplasty lain', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '66.8', 6680000, 'Fimbriectomy', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '66.9', 6690000, 'Prosedur lain pada tuba falopi', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '68.0', 6800000, 'Histerektomi total abdominal', 7500000, ARRAY[14390000]),
(gen_random_uuid(), '68.1', 6810000, 'Histerektomi vaginal', 7000000, ARRAY[14390000]),
(gen_random_uuid(), '68.2', 6820000, 'Histerektomi abdominal anderen', 8000000, ARRAY[14390000]),
(gen_random_uuid(), '68.3', 6830000, 'Laparoscopic total hysterectomy', 8500000, ARRAY[14390000]),
(gen_random_uuid(), '68.4', 6840000, 'Laparoscopic radical hysterectomy', 12000000, ARRAY[14390000]),
(gen_random_uuid(), '68.5', 6850000, 'Laparoscopic radical abdominal hysterectomy', 12000000, ARRAY[14390000]),
(gen_random_uuid(), '68.6', 6860000, 'Other hysterectomy', 7000000, ARRAY[14390000]),
(gen_random_uuid(), '68.7', 6870000, 'Radical hysterectomy anderen', 10000000, ARRAY[14390000]),
(gen_random_uuid(), '68.8', 6880000, 'Pelvic exenteration', 15000000, ARRAY[14390000]),
(gen_random_uuid(), '68.9', 6890000, 'Other operations on uterus', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '69.0', 6900000, 'Dilatasi dan kuret', 2500000, ARRAY[14390000, 15003000]),
(gen_random_uuid(), '69.1', 6910000, 'Prosedur diagnostik D&C', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '69.2', 6920000, 'Perssection of uterine septum', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '69.3', 6930000, 'Endometrial ablation', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '69.4', 6940000, 'Perssection uterine lesion', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '69.5', 6950000, 'Repair of uterus (Manchester operation)', 5000000, ARRAY[15140000]),
(gen_random_uuid(), '69.6', 6960000, 'Laparoscopic removal of uterus', 7000000, ARRAY[15140000]),
(gen_random_uuid(), '69.7', 6970000, 'Repair of uterus other', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '69.9', 6990000, 'Other operations on uterus', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '70.0', 7000000, 'Marsupialisasi kista Bartholin', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '70.1', 7010000, 'Vulvectomi', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '70.2', 7020000, 'Perssection lesion pada vulva dan perineum', 3000000, ARRAY[14390000]),
(gen_random_uuid(), '70.3', 7030000, 'Perssection fistula perineum ke vagina', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '70.4', 7040000, 'Repair of fistula of vulva or perineum', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '70.5', 7050000, 'Closure of vagina', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '70.6', 7060000, 'Vaginoplasti', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '70.7', 7070000, 'Repair of vaginal septum', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '70.8', 7080000, 'Hymenotomy', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '70.9', 7090000, 'Other operations on vagina and cul-de-sac', 3500000, ARRAY[14390000]),
(gen_random_uuid(), '71.0', 7100000, 'Perssection untuk ovarium dan tuba falopi', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '71.1', 7110000, 'Drainage tubo-ovarian or pelvic abscess', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '71.2', 7120000, 'Perssection lesion pada parametrium', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '71.3', 7130000, 'Perssection lesion pada uterus', 5000000, ARRAY[14390000]),
(gen_random_uuid(), '71.4', 7140000, 'Perssection lesion pada broad ligament', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '71.5', 7150000, 'Laparoscopic removal of adnexa', 5500000, ARRAY[14390000]),
(gen_random_uuid(), '71.6', 7160000, 'Perssection lesion pada round ligament', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '71.7', 7170000, 'Laparoscopic lysis of peritoneal adhesions', 4500000, ARRAY[14390000]),
(gen_random_uuid(), '71.8', 7180000, 'Laparoscopic drainage of pelvic abscess', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '71.9', 7190000, 'Other operations on ovary and adnexa', 4000000, ARRAY[14390000]),
(gen_random_uuid(), '72.0', 7200000, 'Forceps delivery low', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '72.1', 7210000, 'Forceps delivery midwifery', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '72.2', 7220000, 'Forceps delivery with episiotomy', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '72.3', 7230000, 'Vacuum delivery', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '72.4', 7240000, 'Delivery with rotation of fetal head', 3500000, ARRAY[15800000]),
(gen_random_uuid(), '72.5', 7250000, 'Cesarean section outros', 6000000, ARRAY[15140000, 15800000]),
(gen_random_uuid(), '72.6', 7260000, 'Cesarean section dengan hysterectomy', 8500000, ARRAY[15140000]),
(gen_random_uuid(), '72.7', 7270000, 'Delivery其他的Perssection cesarean', 6500000, ARRAY[15800000]),
(gen_random_uuid(), '72.8', 7280000, 'Indemoductor uterine', 7000000, ARRAY[15140000]),
(gen_random_uuid(), '72.9', 7290000, 'Obstetric forceps and vacuum delivery outros', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '73.0', 7300000, 'Artificial rupture of membranes', 1500000, ARRAY[15800000]),
(gen_random_uuid(), '73.1', 7310000, 'Medical induction of labor', 2000000, ARRAY[15800000]),
(gen_random_uuid(), '73.2', 7320000, 'Tokolisis', 2500000, ARRAY[15140000]),
(gen_random_uuid(), '73.3', 7330000, 'Episiotomy', 1500000, ARRAY[15800000]),
(gen_random_uuid(), '73.4', 7340000, 'Repair of obstetric laceration of uterus', 4000000, ARRAY[15140000]),
(gen_random_uuid(), '73.5', 7350000, 'Repair of obstetric laceration of cervix', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '73.6', 7360000, 'Repair of obstetric laceration of vagina', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '73.7', 7370000, 'Repair of obstetric laceration of perineum', 2000000, ARRAY[15800000]),
(gen_random_uuid(), '73.8', 7380000, 'Other operations in preparation for labor', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '73.9', 7390000, 'Other obstetric operations', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '75.0', 7500000, 'Fetal monitoring (胎儿监测)', 1500000, ARRAY[15800000]),
(gen_random_uuid(), '75.1:Intrauterine transfusion', 7510000, 'Intrauterine transfusion', 3000000, ARRAY[15800000]),
(gen_random_uuid(), '75.2', 7520000, 'Fetal diagnosis其它', 2000000, ARRAY[15800000]),
(gen_random_uuid(), '75.3', 7530000, 'Fetal therapy其它', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '75.4', 7540000, 'Operasi pada janin其他', 4000000, ARRAY[15800000]),
(gen_random_uuid(), '75.5', 7550000, 'Repair of current obstetric laceration of uterus', 3500000, ARRAY[15140000]),
(gen_random_uuid(), '75.6', 7560000, 'Hysterotomy for termination of pregnancy', 4000000, ARRAY[15003000]),
(gen_random_uuid(), '75.7', 7570000, 'Other operations on gravid uterus', 3000000, ARRAY[15140000]),
(gen_random_uuid(), '75.8', 7580000, 'Fetal monitoring other', 2000000, ARRAY[15800000]),
(gen_random_uuid(), '75.9', 7590000, 'Other obstetric procedures outros', 2500000, ARRAY[15800000]),
(gen_random_uuid(), '78.0', 7800000, 'Incision and extraction of bone from foot', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '78.1', 7810000, 'Incision and extraction of bone from leg', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '78.2', 7820000, 'Incision and extraction of bone from arm', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '78.3', 7830000, 'Incision and extraction of bone from pelvis', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '78.4', 7840000, 'Incision and extraction of bone from spine', 5000000, ARRAY[7040000]),
(gen_random_uuid(), '78.5', 7850000, 'Incision and extraction of bone from skull', 4500000, ARRAY[7043000]),
(gen_random_uuid(), '78.6', 7860000, 'Perssection bone from neck', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '78.7', 7870000, 'Incision and extraction of bone from rib', 3500000, ARRAY[10018000]),
(gen_random_uuid(), '78.8', 7880000, 'Incision and extraction of bone dari sternum', 4000000, ARRAY[10018000]),
(gen_random_uuid(), '78.9', 7890000, 'Incision and extraction of bone from face', 3500000, ARRAY[7043000]),
(gen_random_uuid(), '79.0', 7900000, 'Closed reduction of fracture without internal fixation', 2500000, ARRAY[19420000]),
(gen_random_uuid(), '79.1', 7910000, 'Closed reduction of fracture with internal fixation', 4000000, ARRAY[19720000]),
(gen_random_uuid(), '79.2', 7920000, 'Open reduction of fracture without internal fixation', 4500000, ARRAY[19420000, 19720000]),
(gen_random_uuid(), '79.3', 7930000, 'Open reduction of fracture with internal fixation', 6000000, ARRAY[19720000]),
(gen_random_uuid(), '79.4', 7940000, 'Perssection bone graft other', 5000000, ARRAY[13540000]),
(gen_random_uuid(), '79.5', 7950000, 'Internal fixation of bone without fracture reduction', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '79.6', 7960000, 'Removal of internal fixation device', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '79.7', 7970000, 'Application of other external fixation device', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '79.8', 7980000, 'Other therapeutic appliance operations on bone', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '79.9', 7990000, 'Other operations on bone', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '80.0', 8000000, 'Arthrotomy for removal of prosthesis', 4000000, ARRAY[13170000]),
(gen_random_uuid(), '80.1', 8010000, 'Synovectomy temporomandibular joint', 3500000, ARRAY[13005000]),
(gen_random_uuid(), '80.2', 8020000, 'Arthrotomy other', 3000000, ARRAY[13005000, 13100000]),
(gen_random_uuid(), '80.3', 8030000, 'Arthroscopy', 2500000, ARRAY[13170000]),
(gen_random_uuid(), '80.4', 8040000, 'Perssection and destruction of lesion of joint', 3500000, ARRAY[13100000]),
(gen_random_uuid(), '80.5', 8050000, 'Excision of intervertebral disc', 6000000, ARRAY[7040000, 13540000]),
(gen_random_uuid(), '80.6', 8060000, 'Partial ostectomy of vertebral column', 5500000, ARRAY[7040000]),
(gen_random_uuid(), '80.7', 8070000, 'Total ostectomy of vertebral column', 7000000, ARRAY[7040000]),
(gen_random_uuid(), '80.8', 8080000, 'Other excision of joint', 4000000, ARRAY[13170000]),
(gen_random_uuid(), '80.9', 8090000, 'Other operations on joint cartilage', 3500000, ARRAY[13170000]),
(gen_random_uuid(), '81.0', 8100000, 'Spinal fusion请求', 8000000, ARRAY[7040000, 13540000]),
(gen_random_uuid(), '81.1', 8110000, 'Arthrodesis of foot and ankle', 5500000, ARRAY[13170000]),
(gen_random_uuid(), '81.2', 8120000, 'Arthrodesis of knee and leg', 6500000, ARRAY[13170000]),
(gen_random_uuid(), '81.3', 8130000, 'Arthrodesis of shoulder and arm', 6000000, ARRAY[13170000]),
(gen_random_uuid(), '81.4', 8140000, 'Arthrodesis of elbow and forearm', 5500000, ARRAY[13170000]),
(gen_random_uuid(), '81.5', 8150000, 'Arthrodesis of wrist and hand', 5000000, ARRAY[13170000]),
(gen_random_uuid(), '81.6', 8160000, 'Other joint fusion', 5500000, ARRAY[13170000]),
(gen_random_uuid(), '81.7', 8170000, 'Arthroplasty with cement', 7500000, ARRAY[13150000, 13170000]),
(gen_random_uuid(), '81.8', 8180000, 'Arthroplasty without cement', 8000000, ARRAY[13150000, 13170000]),
(gen_random_uuid(), '81.9', 8190000, 'Other arthroplasty on joint', 7000000, ARRAY[13170000]),
(gen_random_uuid(), '82.0', 8200000, 'Muscle移植', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '82.1', 8210000, 'Muscle division', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '82.2', 8220000, 'Muscle excision', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '82.3', 8230000, 'Perssection tendon', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '82.4', 8240000, 'Tendon suture', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '82.5', 8250000, 'Tendon lengthening', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '82.6', 8260000, 'Tendon shortening', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '82.7', 8270000, 'Tendon reinsertion', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '82.8', 8280000, 'Repair of tendon and muscle其他', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '82.9', 8290000, 'Other operations on tendon', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '83.0', 8300000, 'Incision and extraction of bone from foot', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '83.1', 8310000, 'Incision and extraction of bone from leg', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '83.2', 8320000, 'Incision and extraction of bone from arm', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '83.3', 8330000, 'Incision and extraction of bone from pelvis', 4500000, ARRAY[13540000]),
(gen_random_uuid(), '83.4', 8340000, 'Incision and extraction of bone from spine', 5500000, ARRAY[7040000]),
(gen_random_uuid(), '83.5', 8350000, 'Incision and extraction of bone from skull', 5000000, ARRAY[7043000]),
(gen_random_uuid(), '83.6', 8360000, 'Perssection bone from neck', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '83.7', 8370000, 'Incision and extraction of bone dari rib', 3500000, ARRAY[10018000]),
(gen_random_uuid(), '83.8', 8380000, 'Incision and extraction of bone dari sternum', 4000000, ARRAY[10018000]),
(gen_random_uuid(), '83.9', 8390000, 'Incision and extraction of bone dari face', 3500000, ARRAY[7043000]),
(gen_random_uuid(), '84.0', 8400000, 'Closed reduction of fracture without internal fixation', 3000000, ARRAY[19820000]),
(gen_random_uuid(), '84.1', 8410000, 'Closed reduction of fracture with internal fixation', 4500000, ARRAY[19720000]),
(gen_random_uuid(), '84.2', 8420000, 'Open reduction of fracture without internal fixation', 5000000, ARRAY[19820000]),
(gen_random_uuid(), '84.3', 8430000, 'Open reduction of fracture with internal fixation', 6500000, ARRAY[19720000]),
(gen_random_uuid(), '84.4', 8440000, 'Perssection bone graft other', 5500000, ARRAY[13540000]),
(gen_random_uuid(), '84.5', 8450000, 'Internal fixation of bone without fracture reduction', 4500000, ARRAY[13540000]),
(gen_random_uuid(), '84.6', 8460000, 'Removal of internal fixation device', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '84.7', 8470000, 'Application of other external fixation device', 4000000, ARRAY[13540000]),
(gen_random_uuid(), '84.8', 8480000, 'Other therapeutic appliance operations on bone', 3500000, ARRAY[13540000]),
(gen_random_uuid(), '84.9', 8490000, 'Other operations on bone', 3000000, ARRAY[13540000]),
(gen_random_uuid(), '86.0', 8600000, 'Incision and extraction of prosthetic device', 4000000, ARRAY[3050000]),
(gen_random_uuid(), '86.1', 8610000, 'Skin graft to hand', 2500000, ARRAY[12003000, 12004000]),
(gen_random_uuid(), '86.2', 8620000, 'Penggantian kulit other', 3000000, ARRAY[12002000]),
(gen_random_uuid(), '86.3', 8630000, 'Perssection lesion on skin', 2000000, ARRAY[12002000, 12004000]),
(gen_random_uuid(), '86.4', 8640000, 'Destruction of lesion on skin', 1500000, ARRAY[12002000, 12004000]),
(gen_random_uuid(), '86.5', 8650000, 'Suture of skin laceration', 1500000, ARRAY[19000000]),
(gen_random_uuid(), '86.6', 8660000, 'Free skin graft to other sites', 3000000, ARRAY[12002000]),
(gen_random_uuid(), '86.7', 8670000, 'Pedicle or flap graft', 3500000, ARRAY[12002000, 12004000]),
(gen_random_uuid(), '86.8', 8680000, 'Revision of skin graft', 3000000, ARRAY[12002000]),
(gen_random_uuid(), '86.9', 8690000, 'Other repair and reconstruction of skin', 2500000, ARRAY[12002000]),
(gen_random_uuid(), '87.0', 8700000, 'Diagnostic radiology of abdomen', 2000000, ARRAY[11035000, 3018000]),
(gen_random_uuid(), '87.1', 8710000, 'Contrast radiography of biliary tract', 2500000, ARRAY[11076000]),
(gen_random_uuid(), '87.2', 8720000, 'Other diagnostic radiology of biliary tract', 2000000, ARRAY[11076000]),
(gen_random_uuid(), '87.3', 8730000, 'Diagnostic radiology of digestive tract', 2500000, ARRAY[11025000, 11052000]),
(gen_random_uuid(), '87.4', 8740000, 'Contrast radiography of urinary system', 3000000, ARRAY[14180000, 14200000]),
(gen_random_uuid(), '87.5', 8750000, 'Other diagnostic radiology of urinary system', 2500000, ARRAY[14180000]),
(gen_random_uuid(), '87.6', 8760000, 'Diagnostic radiology of uterus', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '87.7', 8770000, 'Contrast radiography of uterus', 2500000, ARRAY[14390000]),
(gen_random_uuid(), '87.8', 8780000, 'Other diagnostic radiology of female organs', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '87.9', 8790000, 'Other diagnostic radiology outros', 2000000, ARRAY[11035000]),
(gen_random_uuid(), '88.0', 8800000, 'CT scan of head', 3000000, ARRAY[7040000, 7043000]),
(gen_random_uuid(), '88.1', 8810000, 'CT scan of abdomen', 3500000, ARRAY[11035000, 3018000]),
(gen_random_uuid(), '88.2', 8820000, 'CT scan of other sites', 3000000, ARRAY[10018000, 9201000]),
(gen_random_uuid(), '88.3', 8830000, 'Other diagnostic imaging of abdomen', 2500000, ARRAY[11035000]),
(gen_random_uuid(), '88.4', 8840000, 'Diagnostic imaging of urinary system其他', 2500000, ARRAY[14180000]),
(gen_random_uuid(), '88.5', 8850000, 'Diagnostic imaging of pelvic region', 2500000, ARRAY[14390000]),
(gen_random_uuid(), '88.6', 8860000, 'Diagnostic imaging of extremities', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '88.7', 8870000, 'Scintigraphy outros', 3000000, ARRAY[3050000]),
(gen_random_uuid(), '88.8', 8880000, 'Diagnostic ultrasonography', 2500000, ARRAY[11035000]),
(gen_random_uuid(), '88.9', 8890000, 'Other diagnostic imaging outros', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '89.0', 8900000, 'Esophageal motility studies', 2000000, ARRAY[11025000]),
(gen_random_uuid(), '89.1', 8910000, 'Gastrical acidity test', 1500000, ARRAY[11025000]),
(gen_random_uuid(), '89.2', 8920000, 'Gastrointestinal diagnostic studies outros', 2000000, ARRAY[11025000]),
(gen_random_uuid(), '89.3', 8930000, 'Cardiovascular diagnostic studies outros', 2500000, ARRAY[9200000, 9500000]),
(gen_random_uuid(), '89.4', 8940000, 'Urodynamic studies', 2000000, ARRAY[14390000]),
(gen_random_uuid(), '89.5', 8950000, 'Other diagnostic studies (spirometry etc)', 1500000, ARRAY[10018000]),
(gen_random_uuid(), '89.6', 8960000, 'Other diagnostic studies (EEG, EMG, etc)', 2500000, ARRAY[7040000, 7043000]),
(gen_random_uuid(), '89.7', 8970000, 'Genetics diagnostic studies outros', 2000000, ARRAY[3050000]),
(gen_random_uuid(), '89.8', 8980000, 'Electrocardiogram', 1500000, ARRAY[9200000, 9201000]),
(gen_random_uuid(), '89.9', 8990000, 'Other diagnostic studies其他', 1500000, ARRAY[11035000]),
(gen_random_uuid(), '92.0', 9200000, 'Radioisotope scan and function study of brain', 3000000, ARRAY[7040000, 7043000]),
(gen_random_uuid(), '92.0', 9210000, 'Radioisotope scan of bone marrow', 2500000, ARRAY[11070000]),
(gen_random_uuid(), '92.1', 9210000, 'Radioisotope scan of bone', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '92.2', 9220000, 'Radioisotope scan of cardiovascular system', 3000000, ARRAY[9201000, 9500000]),
(gen_random_uuid(), '92.3', 9230000, 'Radioisotope scan of liver and biliary', 2500000, ARRAY[11076000]),
(gen_random_uuid(), '92.4', 9240000, 'Radioisotope scan of urinary tract', 2000000, ARRAY[14180000]),
(gen_random_uuid(), '92.5', 9250000, 'Radioisotope scan of other sites', 2500000, ARRAY[3050000]),
(gen_random_uuid(), '92.6', 9260000, 'Positron emission tomography (PET)', 4000000, ARRAY[3050000]),
(gen_random_uuid(), '92.7', 9270000, 'Radioisotope therapy', 3500000, ARRAY[3050000]),
(gen_random_uuid(), '93.0', 9300000, 'Diagnostic physical therapy其他的', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '93.1', 9310000, 'Physical therapy exercises', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '93.2', 9320000, 'Other physical therapy', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '93.3', 9330000, 'Speech and reading rehabilitation', 1500000, ARRAY[7040000]),
(gen_random_uuid(), '93.4', 9340000, 'Light therapy outros', 1500000, ARRAY[12004000]),
(gen_random_uuid(), '93.5', 9350000, 'Skilled nursing care其他', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '93.6', 9360000, 'Orthoptics and pleoptics', 1500000, ARRAY[8100000]),
(gen_random_uuid(), '93.7', 9370000, 'Handling of patient outros', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '93.8', 9380000, 'Care convalescent and restorative outros', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '93.9', 9390000, 'Non-surgical removal of therapeutic appliance', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '96.0', 9600000, 'Non换药换敷料', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '96.1', 9610000, '胃肠减压', 1500000, ARRAY[11025000]),
(gen_random_uuid(), '96.2', 9620000, '管饲', 1500000, ARRAY[11025000]),
(gen_random_uuid(), '96.3', 9630000, 'Gastric gavage', 1500000, ARRAY[11025000]),
(gen_random_uuid(), '96.4', 9640000, 'Analgesia lainnya', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '96.5', 9650000, 'Stimulation oftherapies others', 1500000, ARRAY[7032000]),
(gen_random_uuid(), '96.6', 9660000, 'Enteral and parenteral nutrition ini', 2000000, ARRAY[11025000]),
(gen_random_uuid(), '96.7', 9670000, 'Administration of vaccine', 1500000, ARRAY[10000000]),
(gen_random_uuid(), '96.8', 9680000, 'Peritoneal dialysis', 3000000, ARRAY[14180000]),
(gen_random_uuid(), '96.9', 9690000, 'Other therapeutic interventions other', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '97.0', 9700000, 'Replacement of wound dressing', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.1', 9710000, 'Irrigation of wound', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.2', 9720000, 'Other irrigation of wound', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.3', 9730000, 'Cleaning of wound skin', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.4', 9740000, 'Replacement of wound packing', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.5', 9750000, 'Application of external binder', 1000000, ARRAY[12002000]),
(gen_random_uuid(), '97.6', 9760000, 'Application of压舱', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '97.7', 9770000, 'Application of orthopedic device', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '97.8', 9780000, 'Application of prosthetic device', 2500000, ARRAY[13540000]),
(gen_random_uuid(), '97.9', 9790000, 'Application of other therapeutic device', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '98.0', 9800000, 'Removal of intraluminal foreign body from esophagus', 2500000, ARRAY[11025000]),
(gen_random_uuid(), '98.1', 9810000, 'Removal of intraluminal foreign body from stomach', 2500000, ARRAY[11025000]),
(gen_random_uuid(), '98.2', 9820000, 'Removal of intraluminal foreign body from small intestine', 3000000, ARRAY[11025000]),
(gen_random_uuid(), '98.3', 9830000, 'Removal of intraluminal foreign body from large intestine', 3000000, ARRAY[11052000]),
(gen_random_uuid(), '98.4', 9840000, 'Removal of intraluminal foreign body from rectum and anus', 2500000, ARRAY[11052000]),
(gen_random_uuid(), '98.5', 9850000, 'Removal of foreign body from urinary tract', 3000000, ARRAY[14200000]),
(gen_random_uuid(), '98.6', 9860000, 'Removal of intraluminal foreign body from uterus', 2500000, ARRAY[14390000]),
(gen_random_uuid(), '98.9', 9890000, 'Removal of therapeutic appliance other', 2000000, ARRAY[13540000]),
(gen_random_uuid(), '99.0', 9900000, 'Blood transfusion (自体给血)', 2500000, ARRAY[9201000]),
(gen_random_uuid(), '99.1', 9910000, 'Injection or transfusion of blood product', 2000000, ARRAY[9500000]),
(gen_random_uuid(), '99.2', 9920000, 'Injection or infusion of other therapeutic substance', 1500000, ARRAY[9200000]),
(gen_random_uuid(), '99.3', 9930000, 'Prophylactic vaccination', 1500000, ARRAY[10000000]),
(gen_random_uuid(), '99.4', 9940000, 'Hypodermic injection', 1000000, ARRAY[9200000]),
(gen_random_uuid(), '99.5', 9950000, 'Acupuncture and acupressure', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '99.6', 9960000, 'Phototherapy other', 1500000, ARRAY[12004000]),
(gen_random_uuid(), '99.7', 9970000, 'Conservation treatment of dental pressure', 1500000, ARRAY[11002000]),
(gen_random_uuid(), '99.8', 9980000, ' Miscellaneous physical therapy', 1500000, ARRAY[13540000]),
(gen_random_uuid(), '99.9', 9990000, 'Other miscellaneous procedures others', 1000000, ARRAY[10000000]);

-- ============================================================
-- 5. INSURANCE POLICIES
-- ============================================================

INSERT INTO insurance_policies (id, insurance_institution_id, policy_name, max_coverage_amount, valid_from, valid_until, is_active, approved_diagnosis_root, approved_procedure_root)
VALUES
('pp111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Asuransi Kesehatan Premium Jakarta', 10000000, '2024-01-01', '2026-12-31', true, 
 '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
 '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456'),
('pp222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Asuransi Kesehatan Standar Jakarta', 5000000, '2024-01-01', '2026-12-31', true,
 '0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef',
 '0xbcdef12345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1'),
('pp333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Asuransi Kesehatan Surabaya Platinum', 15000000, '2024-01-01', '2026-12-31', true,
 '0x3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef',
 '0xcdef23456789012cdef23456789012cdef23456789012cdef23456789012cdef23456789012cdef23456789012cdef23456789012cdef23456789012cdef'),
('pp444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Asuransi Kesehatan Bandung Gold', 7500000, '2024-01-01', '2026-12-31', true,
 '0x4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef',
 '0xdef34567890123def34567890123def34567890123def34567890123def34567890123def34567890123def34567890123def34567890123def3456789');

-- ============================================================
-- 6. PATIENTS
-- ============================================================

INSERT INTO patients (id, user_id, nik_hash, full_name, birth_year, gender, registered_by) VALUES
('p1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'John Doe', 1985, 'M', 'a1111111-1111-1111-1111-111111111111'),
('p2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856', 'Jane Smith', 1990, 'F', 'a2222222-2222-2222-2222-222222222222'),
('p3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857', 'Robert Tan', 1978, 'M', 'a3333333-3333-3333-3333-333333333333'),
('p4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b858', 'Lina Hartono', 1992, 'F', 'a4444444-4444-4444-4444-444444444444'),
('p5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b859', 'Michael Wijaya', 1988, 'M', 'a1111111-1111-1111-1111-111111111111'),
('p6666666-6666-6666-6666-666666666666', 'c6666666-6666-6666-6666-666666666666', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85a', 'Siti Nurhaliza', 1995, 'F', 'a2222222-2222-2222-2222-222222222222'),
('p7777777-7777-7777-7777-777777777777', 'c7777777-7777-7777-7777-777777777777', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85b', 'David Lee', 1982, 'M', 'a3333333-3333-3333-3333-333333333333'),
('p8888888-8888-8888-8888-888888888888', 'c8888888-8888-8888-8888-888888888888', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85c', 'Emma Santoso', 1991, 'F', 'a4444444-4444-4444-4444-444444444444'),
('p9999999-9999-9999-9999-999999999999', 'c9999999-9999-9999-9999-999999999999', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85d', 'Frank Chen', 1975, 'M', 'a1111111-1111-1111-1111-111111111111'),
('pa000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000000', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85e', 'Grace Tanoto', 1989, 'F', 'a2222222-2222-2222-2222-222222222222');

-- ============================================================
-- 7. PATIENT POLICIES
-- ============================================================

INSERT INTO patient_policies (id, patient_id, policy_id, policy_number, policy_commitment, start_date, end_date, is_active) VALUES
('pap11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'pp111111-1111-1111-1111-111111111111', 'POL-JD-001', '0x1111111111111111111111111111111111111111111111111111111111111111', '2024-01-15', '2025-01-14', true),
('pap22222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 'pp111111-1111-1111-1111-111111111111', 'POL-JS-002', '0x2222222222222222222222222222222222222222222222222222222222222222', '2024-02-01', '2025-01-31', true),
('pap33333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333', 'pp222222-2222-2222-2222-222222222222', 'POL-RT-003', '0x3333333333333333333333333333333333333333333333333333333333333333', '2024-03-01', '2025-02-28', true),
('pap44444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444444', 'pp333333-3333-3333-3333-333333333333', 'POL-LH-004', '0x4444444444444444444444444444444444444444444444444444444444444444', '2024-04-01', '2025-03-31', true),
('pap55555-5555-5555-5555-555555555555', 'p5555555-5555-5555-5555-555555555555', 'pp222222-2222-2222-2222-222222222222', 'POL-MW-005', '0x5555555555555555555555555555555555555555555555555555555555555555', '2024-05-01', '2025-04-30', true),
('pap66666-6666-6666-6666-666666666666', 'p6666666-6666-6666-6666-666666666666', 'pp111111-1111-1111-1111-111111111111', 'POL-SN-006', '0x6666666666666666666666666666666666666666666666666666666666666666', '2024-06-01', '2025-05-31', true),
('pap77777-7777-7777-7777-777777777777', 'p7777777-7777-7777-7777-777777777777', 'pp444444-4444-4444-4444-444444444444', 'POL-DL-007', '0x7777777777777777777777777777777777777777777777777777777777777777', '2024-07-01', '2025-06-30', true),
('pap88888-8888-8888-8888-888888888888', 'p8888888-8888-8888-8888-888888888888', 'pp333333-3333-3333-3333-333333333333', 'POL-ES-008', '0x8888888888888888888888888888888888888888888888888888888888888888', '2024-08-01', '2025-07-31', true),
('pap99999-9999-9999-9999-999999999999', 'p9999999-9999-9999-9999-999999999999', 'pp444444-4444-4444-4444-444444444444', 'POL-FC-009', '0x9999999999999999999999999999999999999999999999999999999999999999', '2024-09-01', '2025-08-31', true),
('pap00000-0000-0000-0000-000000000000', 'pa000000-0000-0000-0000-000000000000', 'pp222222-2222-2222-2222-222222222222', 'POL-GT-010', '0x0000000000000000000000000000000000000000000000000000000000000000', '2024-10-01', '2025-09-30', true);

-- ============================================================
-- 8. MEDICAL RECORDS (Generate 100 records for load test)
-- ============================================================

DO $$
DECLARE
  i INTEGER;
  patient_ids UUID[] := ARRAY[
    'p1111111-1111-1111-1111-111111111111'::UUID,
    'p2222222-2222-2222-2222-222222222222'::UUID,
    'p3333333-3333-3333-3333-333333333333'::UUID,
    'p4444444-4444-4444-4444-444444444444'::UUID,
    'p5555555-5555-5555-5555-555555555555'::UUID,
    'p6666666-6666-6666-6666-666666666666'::UUID,
    'p7777777-7777-7777-7777-777777777777'::UUID,
    'p8888888-8888-8888-8888-888888888888'::UUID,
    'p9999999-9999-9999-9999-999999999999'::UUID,
    'pa000000-0000-0000-0000-000000000000'::UUID
  ];
  diag_ids UUID[];
  rec_id UUID;
BEGIN
  -- Get first 100 diagnosis IDs
  SELECT ARRAY_AGG(id) INTO diag_ids FROM diagnoses LIMIT 100;
  
  FOR i IN 1..100 LOOP
    rec_id := gen_random_uuid();
    INSERT INTO medical_records (id, patient_id, hospital_institution_id, diagnosis_id, diagnosis_date, diagnosis_date_encoded, attending_doctor_id)
    VALUES (
      rec_id,
      patient_ids[1 + (i % 10)],
      CASE WHEN i % 4 = 0 THEN '22222222-2222-2222-2222-222222222222'::UUID
           WHEN i % 4 = 1 THEN '33333333-3333-3333-3333-333333333333'::UUID
           WHEN i % 4 = 2 THEN '44444444-4444-4444-4444-444444444444'::UUID
           ELSE '11111111-1111-1111-1111-111111111111'::UUID END,
      diag_ids[1 + (i % array_length(diag_ids, 1))],
      CURRENT_DATE - (i % 180),
      CAST(TO_CHAR(CURRENT_DATE - (i % 180), 'YYYYMMDD') AS INTEGER),
      CASE WHEN i % 4 = 0 THEN 'a2222222-2222-2222-2222-222222222222'::UUID
           WHEN i % 4 = 1 THEN 'a3333333-3333-3333-3333-333333333333'::UUID
           WHEN i % 4 = 2 THEN 'a4444444-4444-4444-4444-444444444444'::UUID
           ELSE 'a1111111-1111-1111-1111-111111111111'::UUID END
    );
  END LOOP;
END $$;

-- ============================================================
-- 9. CLAIMS (Generate claims with various statuses)
-- ============================================================

DO $$
DECLARE
  i INTEGER;
  ppolicy_ids UUID[] := ARRAY[
    'pap11111-1111-1111-1111-111111111111'::UUID,
    'pap22222-2222-2222-2222-222222222222'::UUID,
    'pap33333-3333-3333-3333-333333333333'::UUID,
    'pap44444-4444-4444-4444-444444444444'::UUID,
    'pap55555-5555-5555-5555-555555555555'::UUID,
    'pap66666-6666-6666-6666-666666666666'::UUID,
    'pap77777-7777-7777-7777-777777777777'::UUID,
    'pap88888-8888-8888-8888-888888888888'::UUID,
    'pap99999-9999-9999-9999-999999999999'::UUID,
    'pap00000-0000-0000-0000-000000000000'::UUID
  ];
  proc_ids UUID[];
  mr_ids UUID[];
  claim_status TEXT;
  claim_id UUID;
BEGIN
  -- Get procedure IDs and medical record IDs
  SELECT ARRAY_AGG(id) INTO proc_ids FROM procedures LIMIT 50;
  SELECT ARRAY_AGG(id) INTO mr_ids FROM medical_records LIMIT 100;
  
  -- Generate 200 claims
  FOR i IN 1..200 LOOP
    claim_id := gen_random_uuid();
    
    -- Distribute statuses: 50 submitted, 50 approved, 50 rejected, 25 pending, 25 canceled
    CASE
      WHEN i <= 50 THEN claim_status := 'submitted';
      WHEN i > 50 AND i <= 100 THEN claim_status := 'approved';
      WHEN i > 100 AND i <= 150 THEN claim_status := 'rejected';
      WHEN i > 150 AND i <= 175 THEN claim_status := 'pending';
      ELSE claim_status := 'submitted'; -- Canceled handled separately
    END CASE;
    
    INSERT INTO claims (
      id, patient_policy_id, medical_record_id, procedure_id,
      procedure_date, procedure_date_encoded, claim_amount, status,
      submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes
    ) VALUES (
      claim_id,
      ppolicy_ids[1 + (i % 10)],
      mr_ids[1 + (i % array_length(mr_ids, 1))],
      proc_ids[1 + (i % array_length(proc_ids, 1))],
      CURRENT_DATE - (i % 90),
      CAST(TO_CHAR(CURRENT_DATE - (i % 90), 'YYYYMMDD') AS INTEGER),
      1000000 + (i * 50000),
      claim_status,
      CASE WHEN i % 4 = 0 THEN 'a2222222-2222-2222-2222-222222222222'::UUID
           WHEN i % 4 = 1 THEN 'a3333333-3333-3333-3333-333333333333'::UUID
           WHEN i % 4 = 2 THEN 'a4444444-4444-4444-4444-444444444444'::UUID
           ELSE 'a1111111-1111-1111-1111-111111111111'::UUID END,
      CURRENT_TIMESTAMP - (i || ' days')::INTERVAL,
      CASE WHEN claim_status IN ('approved', 'rejected') 
           THEN 'b1111111-1111-1111-1111-111111111111'::UUID ELSE NULL END,
      CASE WHEN claim_status IN ('approved', 'rejected') 
           THEN CURRENT_TIMESTAMP - ((i % 60) || ' days')::INTERVAL ELSE NULL END,
      CASE WHEN claim_status = 'rejected' 
           THEN 'Tidak memenuhi criteria polis' ELSE NULL END
    );
    
    -- Add some canceled claims (25 more)
    IF i > 175 THEN
      UPDATE claims SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP, 
        canceled_by = 'c1111111-1111-1111-1111-111111111111'::UUID,
        cancel_reason = 'Pasien membatalkan pengajuan klaim'
      WHERE id = claim_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 10. DUMMY ZKP PROOFS (for load testing verification)
-- ============================================================
-- These are DUMMY proofs with correct JSON structure but invalid cryptographic values
-- They will cause verification to fail, but that's fine for load testing

DO $$
DECLARE
  claim_rec RECORD;
  dummy_proof JSONB;
  dummy_signals JSONB;
BEGIN
  -- Get all submitted and approved claims (statuses that have proofs or need verification)
  FOR claim_rec IN 
    SELECT id FROM claims WHERE status IN ('submitted', 'approved')
    ORDER BY submitted_at DESC
    LIMIT 100
  LOOP
    dummy_proof := jsonb_build_object(
      'pi_a', ARRAY['12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345', '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345'],
      'pi_b', ARRAY[ARRAY['12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345', '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345'], ARRAY['12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345', '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345']],
      'pi_c', ARRAY['12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345', '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345'],
      'protocol', 'groth16',
      'curve', 'bn128'
    );
    
    dummy_signals := ARRAY[
      '1234567',           -- procedureCode
      '20240101',         -- procedureDate  
      '1500000',          -- claimAmount
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', -- approvedDiagnosisRoot
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', -- approvedProcedureRoot
      '10000000'          -- maxCoverageAmount
    ];
    
    INSERT INTO zkp_proofs (id, claim_id, proof_json, public_signals, verification_result, proof_generated_at)
    VALUES (
      gen_random_uuid(),
      claim_rec.id,
      dummy_proof,
      dummy_signals,
      CASE WHEN claim_rec.id IS NOT NULL THEN false ELSE NULL END, -- Fake result
      CURRENT_TIMESTAMP - '1 day'::INTERVAL
    );
  END LOOP;
END $$;

-- ============================================================
-- 11. POLICY COVERED DIAGNOSES & PROCEDURES (for ZKP Merkle trees)
-- ============================================================

DO $$
DECLARE
  pol_id UUID;
  diag_id UUID;
  proc_id UUID;
BEGIN
  FOR pol_id IN SELECT id FROM insurance_policies LOOP
    -- Add random diagnoses to each policy (5 diagnoses each)
    FOR diag_id IN 
      SELECT id FROM diagnoses ORDER BY random() LIMIT 5
    LOOP
      INSERT INTO policy_covered_diagnoses (id, policy_id, diagnosis_id, merkle_leaf_index, merkle_leaf_hash)
      VALUES (gen_random_uuid(), pol_id, diag_id, 
        (SELECT COALESCE(MAX(merkle_leaf_index), -1) + 1 FROM policy_covered_diagnoses WHERE policy_id = pol_id),
        '0x' || substring(md5(random()::text) from 1 for 64));
    END LOOP;
    
    -- Add random procedures to each policy (5 procedures each)
    FOR proc_id IN 
      SELECT id FROM procedures ORDER BY random() LIMIT 5
    LOOP
      INSERT INTO policy_covered_procedures (id, policy_id, procedure_id, merkle_leaf_index, merkle_leaf_hash)
      VALUES (gen_random_uuid(), pol_id, proc_id,
        (SELECT COALESCE(MAX(merkle_leaf_index), -1) + 1 FROM policy_covered_procedures WHERE policy_id = pol_id),
        '0x' || substring(md5(random()::text) from 1 for 64));
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 12. UPDATE INSURANCE POLICIES WITH ACTUAL MERKLE ROOTS
-- ============================================================

DO $$
DECLARE
  pol RECORD;
  diag_hash TEXT;
  proc_hash TEXT;
BEGIN
  FOR pol IN SELECT id FROM insurance_policies LOOP
    -- Calculate fake but consistent root (just for testing)
    UPDATE insurance_policies SET
      approved_diagnosis_root = '0x' || substring(md5(pol.id::text || 'diag') from 1 for 64),
      approved_procedure_root = '0x' || substring(md5(pol.id::text || 'proc') from 1 for 64)
    WHERE id = pol.id;
  END LOOP;
END $$;

-- ============================================================
-- SUMMARY OUTPUT
-- ============================================================

DO $$
DECLARE
  claim_count INTEGER;
  patient_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO claim_count FROM claims;
  SELECT COUNT(*) INTO patient_count FROM patients;
  SELECT COUNT(*) INTO policy_count FROM insurance_policies;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'LOAD TEST DATA SEEDED SUCCESSFULLY!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Total Claims: %', claim_count;
  RAISE NOTICE 'Total Patients: %', patient_count;
  RAISE NOTICE 'Total Policies: %', policy_count;
  RAISE NOTICE 'Institutions: 6 (4 hospitals + 2 insurance)';
  RAISE NOTICE 'Users: 18 (4 hospital staff + 3 insurance reviewers + 10 patients + 1 admin)';
  RAISE NOTICE 'Medical Records: 100';
  RAISE NOTICE 'Procedures: ~200';
  RAISE NOTICE 'Diagnoses: ~150';
  RAISE NOTICE 'ZKP Proofs: ~100 (dummy proofs for load testing)';
  RAISE NOTICE '==========================================';
END $$;