## Claimly: Sistem Klaim Asuransi Kesehatan Berbasis Zero-Knowledge Proof

---

### 1. Nama Proyek

**Claimly** — *Privacy-Preserving Health Insurance Claim Verification System*

---

### 2. Problem Statement

Proses klaim asuransi kesehatan di Indonesia saat ini mengharuskan rumah sakit mengirimkan rekam medis pasien secara lengkap ke perusahaan asuransi — termasuk diagnosis, tanggal sakit, dan riwayat kondisi medis. Ini menciptakan dua masalah besar.

Pertama, **privasi pasien terancam**. Data diagnosis yang dikirim ke asuransi bisa digunakan untuk kepentingan lain — misalnya menaikkan premi di renewal berikutnya, menolak klaim kondisi yang "dianggap berhubungan", atau bahkan bocor akibat data breach di sistem asuransi. Padahal untuk memproses klaim, asuransi sebenarnya hanya perlu tahu *apakah prosedur yang diklaim valid dan sesuai polis* — bukan detail diagnosis pasien.

Kedua, **tidak ada mekanisme verifikasi yang bisa memisahkan "apa yang perlu dibuktikan" dari "data yang dipakai untuk membuktikannya"**. Selama ini satu-satunya cara asuransi bisa yakin bahwa klaim valid adalah dengan melihat semua datanya langsung.

Claimly hadir untuk memutus masalah ini dengan menggunakan Zero-Knowledge Proof: rumah sakit bisa **membuktikan bahwa sebuah klaim valid** tanpa pernah mengungkapkan diagnosis atau detail medis sensitif ke pihak asuransi.

---

### 3. Deskripsi Singkat

Claimly adalah platform web fullstack yang memfasilitasi proses pengajuan dan verifikasi klaim asuransi kesehatan antara tiga aktor utama: **Rumah Sakit**, **Pasien**, dan **Asuransi**. Platform ini menggunakan ZKP (diimplementasikan dengan Circom + snarkjs) secara off-chain untuk memverifikasi validitas klaim tanpa mengekspos data medis sensitif ke pihak asuransi.

Alur utamanya: RS input data klaim → backend generate ZK proof → proof + public signals dikirim ke asuransi → asuransi verifikasi proof dan approve/reject klaim. Di seluruh alur ini, asuransi tidak pernah melihat diagnosis pasien, tanggal diagnosis, maupun detail polis.

---

### 4. Fitur-Fitur Proyek

**Manajemen Pengguna & Akses (RBAC)**
Tiga role utama: `hospital_staff`, `insurance_reviewer`, dan `patient`. Setiap role punya akses yang sangat berbeda. Hospital staff bisa submit klaim dan input data medis. Insurance reviewer hanya bisa melihat proof + public signals dan approve/reject. Patient bisa melihat status klaimnya sendiri tapi tidak bisa melihat detail yang dikirim ke asuransi.

**Manajemen Polis Asuransi**
Insurance reviewer bisa input dan manage policy templates — daftar diagnosis yang di-cover, daftar prosedur yang di-cover, batas coverage per prosedur, dan periode polis. Dari data ini sistem otomatis build Merkle tree dan simpan root-nya.

**Pendaftaran Pasien & Polis**
Hospital staff mendaftarkan pasien ke sistem dan menghubungkan pasien ke polis asuransi yang aktif. Sistem generate `policyCommitment` (hash dari detail polis pasien) yang akan dipakai sebagai identifier di ZKP.

**Input Data Medis & Diagnosis**
Hospital staff bisa input diagnosis pasien (kode ICD-10) dan tindakan medis (kode ICD-9-CM) ke dalam rekam medis pasien. Data ini disimpan ter-encrypted di database dan tidak bisa diakses oleh role lain.

**Pengajuan Klaim dengan ZKP**
Hospital staff submit klaim — backend otomatis generate ZK proof dari data medis pasien. Proof generation terjadi server-side. Setelah proof berhasil digenerate, data medis sensitif tidak disimpan dalam bentuk yang bisa dibaca asuransi.

**Dashboard Klaim untuk Asuransi**
Insurance reviewer melihat list klaim yang masuk, masing-masing berisi: procedureCode, procedureDate, claimAmount, policyCommitment, dan hasil verifikasi ZKP (valid/invalid). Reviewer bisa approve atau reject dengan tambahan catatan.

**Notifikasi Status Klaim untuk Pasien**
Pasien bisa login dan melihat status klaimnya (pending, approved, rejected) beserta catatan dari reviewer. Pasien tidak bisa melihat proof atau public signals.

**Audit Log**
Setiap aksi penting di-log: siapa yang submit klaim, kapan proof digenerate, kapan verifikasi dijalankan, siapa yang approve/reject. Log ini tidak bisa didelete oleh siapapun — hanya bisa dibaca oleh admin.

**Pagination, Sort, Search**
Semua list view (klaim, pasien, polis, diagnosis, prosedur) implement pagination cursor-based, sort by multiple columns, dan search by nama/kode/tanggal.

---

### 5. Tech Stack

**Frontend:** Next.js 14 (App Router) — sederhana, fokus di functionality bukan estetika. Server Components untuk data fetching, Client Components hanya untuk form dan interaksi.

**Backend:** Next.js API Routes / Route Handlers sebagai backend layer.

**Database & Auth:** Supabase — PostgreSQL untuk database, Supabase Auth untuk autentikasi dan session management, Supabase Storage untuk menyimpan verification key (`.vkey`) dan circuit artifacts (`.wasm`, `.zkey`), RLS untuk row-level security per role, RPC untuk operasi kompleks, Triggers untuk audit log otomatis.

**ZKP:** Circom untuk menulis circuit, snarkjs untuk proof generation dan verification di Node.js runtime, circomlib untuk komponen circuit standar (Poseidon hash, MerkleProof, LessThan, GreaterEqThan).

**State Management:** Zustand untuk global state di frontend (session, klaim yang sedang diproses).

**Testing:** Vitest untuk unit testing logic ZKP dan service layer, Supertest untuk API endpoint testing.

---

### 6. Skema Database

Ini yang paling penting. Semua tabel saling berelasi dan memenuhi syarat minimal 10 tabel dengan interlacing schema.

---

**Tabel 1: `users`**
Ini extension dari Supabase Auth (`auth.users`). Menyimpan data profil tambahan.
```
id (uuid, FK → auth.users.id, PK)
full_name (text)
role (enum: 'hospital_staff' | 'insurance_reviewer' | 'patient' | 'admin')
institution_id (uuid, FK → institutions.id, nullable — null kalau pasien)
created_at (timestamptz)
updated_at (timestamptz)
```

---

**Tabel 2: `institutions`**
Menyimpan data RS dan perusahaan asuransi.
```
id (uuid, PK)
name (text)
type (enum: 'hospital' | 'insurance')
license_number (text, unique)
address (text)
is_active (boolean)
created_at (timestamptz)
```

---

**Tabel 3: `patients`**
Data pasien. Dipisah dari `users` karena pasien bisa didaftarkan oleh RS sebelum mereka punya akun.
```
id (uuid, PK)
user_id (uuid, FK → users.id, nullable — bisa null sebelum pasien aktivasi akun)
nik_hash (text, unique) — NIK di-hash, tidak disimpan plaintext
full_name (text)
birth_year (integer) — hanya tahun, bukan tanggal lahir lengkap
gender (enum: 'M' | 'F')
registered_by (uuid, FK → users.id) — hospital staff yang daftarkan
created_at (timestamptz)
```

---

**Tabel 4: `insurance_policies`**
Template polis dari perusahaan asuransi.
```
id (uuid, PK)
insurance_institution_id (uuid, FK → institutions.id)
policy_name (text)
max_coverage_amount (bigint) — dalam rupiah
valid_from (date)
valid_until (date)
approved_diagnosis_root (text) — Merkle root dari diagnosis yang di-cover
approved_procedure_root (text) — Merkle root dari prosedur yang di-cover
is_active (boolean)
created_at (timestamptz)
```

---

**Tabel 5: `patient_policies`**
Hubungan antara pasien dan polis spesifik yang mereka miliki.
```
id (uuid, PK)
patient_id (uuid, FK → patients.id)
policy_id (uuid, FK → insurance_policies.id)
policy_number (text, unique) — nomor polis individual
policy_commitment (text) — hash(patient_id, policy_id, policy_number, start_date)
start_date (date)
end_date (date)
is_active (boolean)
created_at (timestamptz)
```

---

**Tabel 6: `diagnoses`**
Master data kode ICD-10 yang dipakai di sistem.
```
id (uuid, PK)
icd10_code (text, unique) — e.g. "K35"
icd10_integer_encoding (integer, unique) — e.g. 540, untuk keperluan ZKP
description (text)
category (text) — e.g. "Digestive System"
created_at (timestamptz)
```

---

**Tabel 7: `procedures`**
Master data kode ICD-9-CM untuk prosedur medis.
```
id (uuid, PK)
icd9_code (text, unique) — e.g. "47.01"
icd9_integer_encoding (integer, unique) — e.g. 4701
description (text)
default_max_coverage (bigint)
valid_diagnosis_codes (integer[]) — array of icd10_integer_encoding yang valid untuk prosedur ini
created_at (timestamptz)
```

---

**Tabel 8: `medical_records`**
Rekam medis pasien. Ini data paling sensitif — RLS ketat, hanya hospital staff dari institusi yang menangani yang bisa akses.
```
id (uuid, PK)
patient_id (uuid, FK → patients.id)
hospital_institution_id (uuid, FK → institutions.id)
diagnosis_id (uuid, FK → diagnoses.id)
diagnosis_date (date)
diagnosis_date_encoded (integer) — format YYYYMMDD untuk ZKP
attending_doctor_id (uuid, FK → users.id)
notes_encrypted (text) — catatan dokter ter-encrypt
created_at (timestamptz)
```

---

**Tabel 9: `claims`**
Klaim yang disubmit RS ke asuransi. Ini tabel sentral.
```
id (uuid, PK)
patient_policy_id (uuid, FK → patient_policies.id)
medical_record_id (uuid, FK → medical_records.id)
procedure_id (uuid, FK → procedures.id)
procedure_date (date)
procedure_date_encoded (integer)
claim_amount (bigint)
status (enum: 'pending' | 'proof_generating' | 'proof_failed' | 'submitted' | 'approved' | 'rejected')
submitted_by (uuid, FK → users.id)
reviewed_by (uuid, FK → users.id, nullable)
review_notes (text, nullable)
submitted_at (timestamptz)
reviewed_at (timestamptz, nullable)
```

---

**Tabel 10: `zkp_proofs`**
Menyimpan hasil proof generation. Dipisah dari `claims` karena ukurannya besar dan hanya relevan untuk proses verifikasi.
```
id (uuid, PK)
claim_id (uuid, FK → claims.id, unique)
proof_json (jsonb) — output dari snarkjs, struktur { pi_a, pi_b, pi_c, protocol }
public_signals (jsonb) — array of public inputs dalam bentuk yang bisa dibaca verifier
verification_result (boolean, nullable) — null = belum diverifikasi
proof_generated_at (timestamptz)
verified_at (timestamptz, nullable)
```

---

**Tabel 11: `audit_logs`**
Append-only log untuk semua aksi penting. Di-populate via Trigger, tidak bisa di-insert manual oleh aplikasi.
```
id (uuid, PK)
actor_id (uuid, FK → users.id)
action (text) — e.g. 'CLAIM_SUBMITTED', 'PROOF_GENERATED', 'CLAIM_APPROVED'
entity_type (text) — e.g. 'claims', 'zkp_proofs'
entity_id (uuid)
metadata (jsonb) — detail tambahan, tidak berisi data sensitif
created_at (timestamptz)
```

---

**Tabel 12: `policy_covered_diagnoses`**
Junction table yang menyimpan diagnosis apa saja yang di-cover oleh suatu polis — ini yang dipakai untuk build Merkle tree.
```
id (uuid, PK)
policy_id (uuid, FK → insurance_policies.id)
diagnosis_id (uuid, FK → diagnoses.id)
merkle_leaf_index (integer) — posisi di Merkle tree
merkle_leaf_hash (text) — hash dari icd10_integer_encoding
```

---

### 7. Detail ZKP

#### Input, Siapa yang Memasukkan, dan Dari Mana Asalnya

**Private Inputs** — dimasukkan oleh backend (bukan user secara langsung). Sumber datanya dari tabel `medical_records` dan `patient_policies`, yang hanya bisa diakses oleh hospital staff yang authenticated.

- `diagnosisCode` → dari `diagnoses.icd10_integer_encoding`, di-fetch via `medical_records.diagnosis_id`
- `diagnosisDate` → dari `medical_records.diagnosis_date_encoded`
- `diagnosisMerklePath` → dihitung on-the-fly oleh backend dari data di `policy_covered_diagnoses`
- `diagnosisPathIndices` → sama, dihitung bersamaan dengan Merkle path
- `patientSecret` → di-derive dari kombinasi `patient_policies.policy_commitment` + server-side secret key (environment variable). Tidak disimpan di DB.
- `policyStartDate` → dari `patient_policies.start_date` (di-encode YYYYMMDD)
- `policyEndDate` → dari `patient_policies.end_date`

**Public Inputs** — dikirim ke asuransi bersama proof, dan tersimpan di `zkp_proofs.public_signals`.

- `procedureCode` → dari `procedures.icd9_integer_encoding`
- `procedureDate` → dari `claims.procedure_date_encoded`
- `claimAmount` → dari `claims.claim_amount`
- `approvedDiagnosisRoot` → dari `insurance_policies.approved_diagnosis_root`
- `maxCoverageAmount` → dari `insurance_policies.max_coverage_amount`
- `policyCommitment` → dari `patient_policies.policy_commitment`

---

#### Apa yang Dicek di Circuit

Circuit punya empat kelompok constraint yang harus **semua** terpenuhi. Kalau satu saja gagal, proof tidak bisa digenerate (witness generation akan error sebelum proof dibuat).

**Check 1 — Diagnosis ada di approved list polis:**
Circuit jalankan Merkle inclusion proof. Diberikan `diagnosisCode`, `diagnosisMerklePath`, dan `diagnosisPathIndices`, circuit harus bisa merekonstruksi root dan memastikan hasilnya sama dengan `approvedDiagnosisRoot` yang jadi public input.

**Check 2 — Prosedur valid untuk diagnosis tersebut:**
Ini diimplementasikan sebagai lookup constraint. Di dalam circuit sudah di-hardcode mapping: diagnosis X hanya boleh diklaim dengan prosedur Y atau Z. Circuit memverifikasi bahwa pasangan `(diagnosisCode, procedureCode)` ada dalam mapping yang valid.

**Check 3 — Temporal ordering (anti-fraud):**
Dua sub-check: `procedureDate >= diagnosisDate` (prosedur setelah diagnosis), dan `procedureDate >= policyStartDate` serta `procedureDate <= policyEndDate` (dalam periode polis aktif). Semua tanggal sudah di-encode jadi integer YYYYMMDD sehingga perbandingan numerik langsung valid.

**Check 4 — Nominal klaim dalam batas coverage:**
Range check sederhana: `claimAmount <= maxCoverageAmount`.

---

#### Skenario Berhasil dan Gagal

**Skenario Berhasil:**
RS Siloam submit klaim untuk pasien Budi yang menjalani laparoscopic appendectomy. Diagnosis: K35 (appendicitis acute, encoded: 540), tanggal diagnosis: 15 Januari 2024. Prosedur: 47.01 (encoded: 4701), tanggal prosedur: 20 Januari 2024. Klaim: Rp 15.000.000. Polis aktif dari 1 Jan 2023 sampai 31 Des 2024, max coverage Rp 20 juta. K35 ada di approved diagnosis list polis. Semua constraint terpenuhi → witness berhasil digenerate → proof berhasil dibuat → asuransi jalankan `snarkjs.groth16.verify()` → return `true` → klaim otomatis masuk antrian approval.

**Skenario Gagal #1 — Diagnosis tidak di-cover:**
Pasien didiagnosis K80 (cholelithiasis/batu empedu, encoded: 650), tapi diklaim dengan prosedur appendectomy. K80 memang ada di approved diagnosis list, tapi pasangan (K80, 47.01) tidak valid di lookup table circuit — prosedur appendectomy bukan prosedur yang valid untuk diagnosis batu empedu. Witness generation gagal di Check 2. Proof tidak bisa digenerate. Status klaim jadi `proof_failed`. Audit log mencatat kegagalan tanpa menyimpan detail diagnosis.

**Skenario Gagal #2 — Klaim retroaktif (fraud):**
Hospital staff tidak sengaja input `procedureDate = 20240110` tapi `diagnosisDate = 20240115`. Artinya prosedur diklaim terjadi 5 hari **sebelum** diagnosis. Check 3 gagal karena `procedureDate < diagnosisDate`. Proof tidak bisa digenerate.

**Skenario Gagal #3 — Melebihi coverage:**
Klaim Rp 25.000.000 untuk polis dengan max coverage Rp 20.000.000. Check 4 gagal.

**Skenario Gagal #4 — Proof valid tapi sudah dimanipulasi:**
Asuransi menerima proof tapi seseorang mencoba ganti nilai `claimAmount` di public signals dari 15.000.000 menjadi 25.000.000 sebelum dikirim. Saat `snarkjs.groth16.verify()` dijalankan dengan public signals yang sudah dimodifikasi, verifikasi akan return `false` karena proof secara kriptografis terikat ke nilai public signals yang asli. Ini salah satu proteksi terkuat ZKP.

---

#### Penjelasan Merkle Tree yang Digunakan

Merkle tree dipakai untuk menyelesaikan satu masalah spesifik: **bagaimana cara membuktikan bahwa sebuah diagnosis ada dalam daftar ratusan diagnosis yang di-cover, tanpa harus memasukkan seluruh daftar ke dalam circuit?**

Kalau tidak pakai Merkle tree, circuit harus punya constraint `diagnosisCode == 540 OR diagnosisCode == 541 OR diagnosisCode == 542 OR ...` sebanyak ratusan kode. Ini membuat circuit sangat besar dan lambat. Dengan Merkle tree, cukup satu root hash yang mewakili seluruh list.

**Cara Build Merkle Tree (dilakukan di backend saat insurance reviewer setup polis):**

Misalkan polis A hanya cover 7 diagnosis (contoh kecil):

```
Diagnosis yang di-cover:
Index 0: K35  → encoded: 540  → leaf = Poseidon(540)  = 0xAAA1
Index 1: K36  → encoded: 541  → leaf = Poseidon(541)  = 0xBBB2
Index 2: K37  → encoded: 542  → leaf = Poseidon(542)  = 0xCCC3
Index 3: K80  → encoded: 650  → leaf = Poseidon(650)  = 0xDDD4
Index 4: K81  → encoded: 651  → leaf = Poseidon(651)  = 0xEEE5
Index 5: J18  → encoded: 710  → leaf = Poseidon(710)  = 0xFFF6
Index 6: I21  → encoded: 810  → leaf = Poseidon(810)  = 0xGGG7
Index 7: (padding/empty)      → leaf = Poseidon(0)    = 0xHHH8
```

Tree di-build bottom-up:

```
Level 2 (leaves):  [0xAAA1] [0xBBB2] [0xCCC3] [0xDDD4] [0xEEE5] [0xFFF6] [0xGGG7] [0xHHH8]
                       |         |       |         |       |         |       |         |
Level 1:         Poseidon(AAA1,BBB2) Poseidon(CCC3,DDD4) Poseidon(EEE5,FFF6) Poseidon(GGG7,HHH8)
                       = 0xAB12          = 0xCD34              = 0xEF56           = 0xGH78
                           |                 |                     |                  |
Level 0 (root):     Poseidon(AB12,CD34)                    Poseidon(EF56,GH78)
                          = 0xABCD1234                           = 0xEFGH5678
                                  |                                    |
Root:                       Poseidon(ABCD1234, EFGH5678) = 0xROOT_FINAL
```

Root ini (`0xROOT_FINAL`) disimpan di `insurance_policies.approved_diagnosis_root` dan juga di `policy_covered_diagnoses` untuk tiap leaf-nya.

**Cara Buktikan K35 (index 0) Ada di Tree:**

Untuk buktikan bahwa leaf index 0 (K35 = 0xAAA1) ada di tree dengan root `0xROOT_FINAL`, kita butuh "sibling path" — yaitu node-node yang menjadi pasangan hash di tiap level:

```
Merkle Path untuk K35 (index 0):
- Di Level 2: sibling-nya adalah 0xBBB2 (index 1), posisi = kanan (index 0 = kiri)
- Di Level 1: sibling-nya adalah 0xCD34 (node kanan), posisi = kanan
- Di Level 0: sibling-nya adalah 0xEFGH5678 (node kanan), posisi = kanan

diagnosisMerklePath    = [0xBBB2, 0xCD34, 0xEFGH5678]
diagnosisPathIndices   = [0, 0, 0]  → 0 berarti "node ini di kiri, sibling di kanan"
```

Circuit kemudian melakukan rekonstruksi:
```
hash(0xAAA1, 0xBBB2) → harus = 0xAB12 ✓
hash(0xAB12, 0xCD34) → harus = 0xABCD1234 ✓
hash(0xABCD1234, 0xEFGH5678) → harus = 0xROOT_FINAL ✓
```

Kalau semua level match dengan root, diagnosis terbukti ada di list tanpa circuit perlu tahu isi list lainnya.

**Kenapa Poseidon hash, bukan SHA256?** Karena Poseidon adalah hash function yang dirancang khusus untuk ZK circuits — jauh lebih efisien dalam constraint system. SHA256 di dalam circuit butuh ribuan constraints, Poseidon hanya ratusan. `circomlib` sudah menyediakan komponen `Poseidon` siap pakai.

---

### 8. Detail Tambahan

**RLS (Row Level Security) di Supabase:**
- `medical_records`: hanya bisa di-read oleh `hospital_staff` dari `institution_id` yang sama dengan record tersebut, atau `patient` pemilik record itu sendiri. Insurance reviewer tidak punya akses sama sekali.
- `claims`: hospital_staff bisa insert dan read milik institusinya. Insurance reviewer bisa read semua, update `status` dan `review_notes`. Patient hanya bisa read status klaim miliknya.
- `zkp_proofs`: hospital_staff dan insurance_reviewer bisa read. Tidak ada yang bisa insert via client — hanya bisa di-insert via service role key (dari backend).
- `audit_logs`: semua role bisa read. Tidak ada yang bisa insert, update, atau delete via client.

**Triggers di Supabase:**
- `after_claim_insert`: otomatis insert ke `audit_logs` dengan action `CLAIM_SUBMITTED`
- `after_claim_status_update`: otomatis insert ke `audit_logs` setiap kali `claims.status` berubah
- `after_proof_insert`: otomatis update `claims.status` menjadi `submitted`
- `after_proof_verification`: otomatis insert ke `audit_logs` dengan action `PROOF_VERIFIED` beserta hasilnya

**RPC Functions di Supabase:**
- `submit_claim(medical_record_id, procedure_id, procedure_date, claim_amount)`: single transaction yang insert ke `claims` sekaligus trigger proof generation job
- `approve_claim(claim_id, review_notes)`: update status + insert audit log dalam satu atomic operation
- `get_claims_paginated(page, page_size, sort_by, sort_dir, search_term, status_filter)`: handle pagination cursor-based + sort + search sekaligus, return total count + data

**Storage di Supabase:**
Bucket `zkp-artifacts` menyimpan file `.wasm` (compiled circuit), `.zkey` (proving key), dan `verification_key.json` — file-file ini di-serve ke backend saat proof generation dan verification. Tidak bisa diakses public.

**Seeding Database (50+ data):**
Seed script akan populate: 2 institusi (1 RS, 1 asuransi), 5 hospital staff users, 3 insurance reviewer users, 20 pasien, 15 diagnosis codes (ICD-10), 10 procedure codes (ICD-9-CM), 3 template polis, 20 patient_policies, 30 medical records, 25 claims dengan status bervariasi, dan audit_logs yang otomatis terisi via trigger.

**Unit Testing:**
- Test ZKP service: apakah proof generation menghasilkan proof yang valid untuk input yang benar
- Test circuit constraints: apakah witness generation gagal dengan benar untuk input yang invalid (retroaktif, over-coverage, diagnosis tidak valid)
- Test Merkle tree builder: apakah root yang dihasilkan konsisten
- Test RPC functions: apakah pagination, sort, search menghasilkan output yang benar
- Test RLS: apakah role yang salah benar-benar tidak bisa akses data yang bukan haknya

