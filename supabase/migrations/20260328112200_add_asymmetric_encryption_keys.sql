-- ============================================================
-- Migration: Add Asymmetric Encryption Keys to Users Table
-- Pendekatan: Password-Derived Key Encryption
--
-- Cara kerja:
--   1. Saat signup, browser generate ECDH P-256 keypair
--   2. Password user (sebelum dikirim ke Supabase Auth) dipakai
--      sebagai input PBKDF2 → menghasilkan masterKey (AES-256)
--   3. masterKey digunakan untuk AES-GCM-encrypt private key
--   4. Yang disimpan ke DB:
--      - public_key          : ECDH public key (base64, readable by all)
--      - encrypted_priv_key  : Private key yang sudah di-wrap AES-GCM (base64)
--      - key_derivation_salt : Salt acak untuk PBKDF2 (base64, 32 bytes)
--      - key_iv              : IV untuk AES-GCM decrypt encrypted_priv_key (base64, 12 bytes)
--
-- PENTING:
--   - Server TIDAK PERNAH menerima private key dalam bentuk plaintext
--   - Server TIDAK PERNAH tahu password plaintext user
--   - Dekripsi private key HANYA bisa dilakukan di browser dengan password user
--   - Enkripsi note (sisi dokter) menggunakan public_key pasien yg di-fetch dari DB
-- ============================================================


-- ============================================================
-- 1. TAMBAH KOLOM CRYPTO KE TABEL USERS
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_key          TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS encrypted_priv_key  TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS key_derivation_salt TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS key_iv              TEXT DEFAULT NULL;

-- Tambahkan komentar pada kolom untuk dokumentasi
COMMENT ON COLUMN users.public_key IS
    'ECDH P-256 public key dalam format SPKI, di-encode base64. '
    'Boleh dibaca oleh siapapun (dokter) untuk mengenkripsi notes. '
    'NULL berarti user belum generate keypair (bukan pasien, atau signup lama).';

COMMENT ON COLUMN users.encrypted_priv_key IS
    'ECDH P-256 private key yang sudah di-wrap menggunakan AES-256-GCM. '
    'KEK (Key Encryption Key) di-derive dari password user via PBKDF2. '
    'Hanya bisa di-unwrap di browser dengan password user yang benar.';

COMMENT ON COLUMN users.key_derivation_salt IS
    'Salt acak (32 bytes, base64) untuk PBKDF2 key derivation. '
    'Harus unik per user. Dikirim ke client saat login agar PBKDF2 bisa di-derive ulang.';

COMMENT ON COLUMN users.key_iv IS
    'Initialization Vector (12 bytes, base64) untuk AES-GCM. '
    'Digunakan bersama masterKey untuk decrypt encrypted_priv_key.';


-- ============================================================
-- 2. INDEX
-- ============================================================

-- Index untuk lookup public key berdasarkan user id (dipakai dokter saat enkripsi)
-- Sudah ada PK index di users.id, tapi kita buat partial index
-- agar query public_key lebih efisien
CREATE INDEX IF NOT EXISTS idx_users_public_key_not_null
    ON users (id)
    WHERE public_key IS NOT NULL;


-- ============================================================
-- 3. RLS — KEBIJAKAN AKSES UNTUK KOLOM CRYPTO
-- ============================================================

-- Kebijakan yang sudah ada di users table:
--   users_read_own   : user hanya bisa read row miliknya sendiri, atau admin
--   users_update_own : user hanya bisa update row miliknya sendiri
--
-- Kolom baru (public_key, encrypted_priv_key, key_derivation_salt, key_iv)
-- sudah otomatis ikut kebijakan tersebut karena RLS bekerja di level ROW,
-- bukan kolom.
--
-- Namun kita perlu:
--   A. Fungsi RPC khusus agar dokter bisa fetch public_key pasien
--      tanpa bisa lihat kolom sensitif lain dari row users pasien
--   B. Fungsi RPC untuk menyimpan keypair saat signup


-- ============================================================
-- 3A. RPC: Simpan keypair saat signup (dipanggil setelah auth.signUp berhasil)
-- ============================================================

CREATE OR REPLACE FUNCTION save_user_keypair(
    p_public_key          TEXT,
    p_encrypted_priv_key  TEXT,
    p_key_derivation_salt TEXT,
    p_key_iv              TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Hanya boleh menyimpan keypair milik diri sendiri
    UPDATE users
    SET
        public_key          = p_public_key,
        encrypted_priv_key  = p_encrypted_priv_key,
        key_derivation_salt = p_key_derivation_salt,
        key_iv              = p_key_iv,
        updated_at          = NOW()
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found or not authenticated';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION save_user_keypair IS
    'RPC untuk menyimpan ECDH keypair saat signup. '
    'Dipanggil dari client setelah Supabase Auth signup berhasil. '
    'Hanya bisa dipakai untuk menyimpan keypair milik caller (auth.uid()).';


-- ============================================================
-- 3B. RPC: Fetch data yang dibutuhkan untuk decrypt private key (saat login)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_crypto_data()
RETURNS TABLE (
    encrypted_priv_key  TEXT,
    key_derivation_salt TEXT,
    key_iv              TEXT
) AS $$
BEGIN
    RETURN QUERY
        SELECT
            u.encrypted_priv_key,
            u.key_derivation_salt,
            u.key_iv
        FROM users u
        WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_my_crypto_data IS
    'RPC untuk mengambil data crypto milik caller (encrypted_priv_key, salt, iv). '
    'Dipanggil dari client setelah login agar browser bisa derive masterKey '
    'dan unwrap private key menggunakan password user.';


-- ============================================================
-- 3C. RPC: Fetch public key satu pasien berdasarkan patient_id
--     (dipakai dokter saat enkripsi notes)
-- ============================================================

CREATE OR REPLACE FUNCTION get_patient_public_key(
    p_patient_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_caller_role    TEXT;
    v_caller_inst_id UUID;
    v_result         TEXT;
BEGIN
    -- Ambil role & institution caller
    SELECT role, institution_id
    INTO v_caller_role, v_caller_inst_id
    FROM users
    WHERE id = auth.uid();

    -- Hanya hospital_staff yang boleh fetch public key pasien
    -- (untuk keperluan enkripsi notes_encrypted)
    IF v_caller_role != 'hospital_staff' THEN
        RAISE EXCEPTION 'Access denied: only hospital_staff can fetch patient public keys';
    END IF;

    -- Guard: pastikan caller punya keterkaitan dengan pasien ini.
    -- Dua kondisi yang diterima (OR):
    --   1. Pasien pernah berobat ke institusi caller (sudah ada medical_records)
    --   2. Pasien didaftarkan oleh staff dari institusi caller (rekam medis pertama,
    --      belum ada medical_record sama sekali tapi dokter mau tulis catatan)
    -- Ini mencegah hospital A mengambil public key pasien hospital B.
    IF NOT EXISTS (
        SELECT 1
        FROM patients p
        WHERE p.id = p_patient_id
          AND (
              -- kondisi 1: sudah ada rekam medis di institusi ini
              EXISTS (
                  SELECT 1 FROM medical_records mr
                  WHERE mr.patient_id             = p.id
                    AND mr.hospital_institution_id = v_caller_inst_id
              )
              OR
              -- kondisi 2: pasien didaftarkan oleh staff institusi ini
              EXISTS (
                  SELECT 1 FROM users registrar
                  WHERE registrar.id             = p.registered_by
                    AND registrar.institution_id = v_caller_inst_id
              )
          )
    ) THEN
        RAISE EXCEPTION 'Access denied: patient is not associated with your institution';
    END IF;

    -- Ambil public_key pasien (via tabel patients → users)
    -- Kembalikan NULL jika pasien belum aktivasi akun / belum generate keypair
    SELECT u.public_key
    INTO v_result
    FROM patients p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = p_patient_id
      AND u.public_key IS NOT NULL;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_patient_public_key IS
    'RPC untuk mengambil public key pasien berdasarkan patient_id. '
    'Hanya bisa dipanggil oleh hospital_staff yang punya keterkaitan dengan pasien: '
    'pasien pernah berobat di institusinya ATAU pasien didaftarkan oleh staff institusinya. '
    'Guard ganda ini memastikan dokter bisa enkripsi notes bahkan untuk rekam medis pertama. '
    'Mengembalikan NULL jika pasien belum aktivasi akun atau belum generate keypair.';


-- ============================================================
-- 3D. RPC: Update keypair saat user ganti password
--     PENTING: Harus dipanggil BERSAMAAN dengan password change
--     agar encrypted_priv_key tetap bisa di-decrypt dengan password baru
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_keypair(
    p_encrypted_priv_key  TEXT,
    p_key_derivation_salt TEXT,
    p_key_iv              TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Re-encrypt private key dengan masterKey baru (derived dari password baru)
    -- Public key TIDAK berubah — hanya wrapping-nya yang berubah
    UPDATE users
    SET
        encrypted_priv_key  = p_encrypted_priv_key,
        key_derivation_salt = p_key_derivation_salt,
        key_iv              = p_key_iv,
        updated_at          = NOW()
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found or not authenticated';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_user_keypair IS
    'RPC untuk update encrypted_priv_key saat user ganti password. '
    'Harus dipanggil BERSAMAAN dengan Supabase Auth password change. '
    'Alurnya: (1) client decrypt priv key pakai password lama, '
    '(2) client re-encrypt priv key pakai password baru, '
    '(3) panggil update_user_keypair + Supabase Auth updateUser secara concurrent. '
    'Public key TIDAK berubah sehingga catatan lama yang sudah dienkripsi tetap bisa dibaca.';
