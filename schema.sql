


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."roles" AS ENUM (
    'hospital_staff',
    'insurance_reviewer',
    'patient',
    'admin'
);


ALTER TYPE "public"."roles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE claims
    SET
        status = 'approved',
        reviewed_by = p_reviewer_id,
        review_notes = p_review_notes,
        reviewed_at = NOW()
    WHERE id = p_claim_id AND status = 'submitted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or not in submitted status';
    END IF;
END;
$$;


ALTER FUNCTION "public"."approve_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_claim_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        NEW.submitted_by,
        'CLAIM_SUBMITTED',
        'claims',
        NEW.id,
        jsonb_build_object(
            'claim_amount', NEW.claim_amount,
            'procedure_date', NEW.procedure_date,
            'status', NEW.status
        )
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_claim_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_claim_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            COALESCE(NEW.reviewed_by, NEW.submitted_by),
            'CLAIM_STATUS_CHANGED',
            'claims',
            NEW.id,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'review_notes', NEW.review_notes
            )
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_claim_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_proof_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_submitted_by UUID;
BEGIN
    SELECT submitted_by INTO v_submitted_by FROM claims WHERE id = NEW.claim_id;
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_submitted_by,
        'PROOF_GENERATED',
        'zkp_proofs',
        NEW.id,
        jsonb_build_object('claim_id', NEW.claim_id)
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_proof_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_proof_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF OLD.verification_result IS NULL AND NEW.verification_result IS NOT NULL THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            NULL, 'PROOF_VERIFIED', 'zkp_proofs', NEW.id,
            jsonb_build_object('claim_id', NEW.claim_id, 'verification_result', NEW.verification_result)
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_proof_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_policy_with_relations"("p_insurance_institution_id" "uuid", "p_policy_name" "text", "p_max_coverage_amount" numeric, "p_valid_from" timestamp with time zone, "p_valid_until" timestamp with time zone, "p_approved_diagnosis_root" "text", "p_approved_procedure_root" "text", "p_is_active" boolean, "p_diagnoses" "jsonb", "p_procedures" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_policy_id UUID;
BEGIN
    -- 1. Insert ke tabel utama (insurance_policies)
    INSERT INTO insurance_policies (
        insurance_institution_id,
        policy_name,
        max_coverage_amount,
        valid_from,
        valid_until,
        approved_diagnosis_root,
        approved_procedure_root,
        is_active
    ) VALUES (
        p_insurance_institution_id,
        p_policy_name,
        p_max_coverage_amount,
        p_valid_from,
        p_valid_until,
        p_approved_diagnosis_root,
        p_approved_procedure_root,
        p_is_active
    ) 
    RETURNING id INTO v_policy_id;

    -- 2. Insert array of objects ke policy_covered_diagnoses (jika ada)
    IF p_diagnoses IS NOT NULL AND jsonb_array_length(p_diagnoses) > 0 THEN
        INSERT INTO policy_covered_diagnoses (
            policy_id,
            diagnosis_id,
            merkle_leaf_index,
            merkle_leaf_hash
        )
        SELECT 
            v_policy_id,
            (elem->>'diagnosis_id')::UUID,
            (elem->>'merkle_leaf_index')::INTEGER,
            elem->>'merkle_leaf_hash'
        FROM jsonb_array_elements(p_diagnoses) AS elem;
    END IF;

    -- 3. Insert array of objects ke policy_covered_procedures (jika ada)
    IF p_procedures IS NOT NULL AND jsonb_array_length(p_procedures) > 0 THEN
        INSERT INTO policy_covered_procedures (
            policy_id,
            procedure_id,
            merkle_leaf_index,
            merkle_leaf_hash
        )
        SELECT 
            v_policy_id,
            (elem->>'procedure_id')::UUID,
            (elem->>'merkle_leaf_index')::INTEGER,
            elem->>'merkle_leaf_hash'
        FROM jsonb_array_elements(p_procedures) AS elem;
    END IF;

    -- Return ID yang baru saja dibuat
    RETURN v_policy_id;
END;
$$;


ALTER FUNCTION "public"."create_policy_with_relations"("p_insurance_institution_id" "uuid", "p_policy_name" "text", "p_max_coverage_amount" numeric, "p_valid_from" timestamp with time zone, "p_valid_until" timestamp with time zone, "p_approved_diagnosis_root" "text", "p_approved_procedure_root" "text", "p_is_active" boolean, "p_diagnoses" "jsonb", "p_procedures" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_claims_paginated"("p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 10, "p_sort_by" "text" DEFAULT 'submitted_at'::"text", "p_sort_dir" "text" DEFAULT 'desc'::"text", "p_status" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("claim_id" "uuid", "procedure_code" "text", "procedure_description" "text", "procedure_date" "date", "claim_amount" bigint, "status" "text", "submitted_at" timestamp with time zone, "reviewed_at" timestamp with time zone, "policy_commitment" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_limit;
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT
            c.id,
            pr.icd9_code,
            pr.description,
            c.procedure_date,
            c.claim_amount,
            c.status,
            c.submitted_at,
            c.reviewed_at,
            pp.policy_commitment,
            COUNT(*) OVER() AS total_count
        FROM claims c
        JOIN procedures pr ON pr.id = c.procedure_id
        JOIN patient_policies pp ON pp.id = c.patient_policy_id
        WHERE ($1::TEXT IS NULL OR c.status = $1)
        AND ($2::TEXT IS NULL OR pr.description ILIKE ''%%'' || $2 || ''%%'')
        ORDER BY %I %s
        LIMIT $3 OFFSET $4',
        p_sort_by,
        p_sort_dir
    )
    USING p_status, p_search, p_limit, v_offset;
END;
$_$;


ALTER FUNCTION "public"."get_claims_paginated"("p_page" integer, "p_limit" integer, "p_sort_by" "text", "p_sort_dir" "text", "p_status" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_crypto_data"() RETURNS TABLE("encrypted_priv_key" "text", "key_derivation_salt" "text", "key_iv" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
        SELECT
            u.encrypted_priv_key,
            u.key_derivation_salt,
            u.key_iv
        FROM users u
        WHERE u.id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_my_crypto_data"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_crypto_data"() IS 'RPC untuk mengambil data crypto milik caller (encrypted_priv_key, salt, iv). Dipanggil dari client setelah login agar browser bisa derive masterKey dan unwrap private key menggunakan password user.';



CREATE OR REPLACE FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") IS 'RPC untuk mengambil public key pasien berdasarkan patient_id. Hanya bisa dipanggil oleh hospital_staff yang punya keterkaitan dengan pasien: pasien pernah berobat di institusinya ATAU pasien didaftarkan oleh staff institusinya. Guard ganda ini memastikan dokter bisa enkripsi notes bahkan untuk rekam medis pertama. Mengembalikan NULL jika pasien belum aktivasi akun atau belum generate keypair.';



CREATE OR REPLACE FUNCTION "public"."get_user_institution_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT institution_id FROM users WHERE id = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."get_user_institution_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT role FROM users WHERE id = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
    INSERT INTO public.users (id, full_name, role, institution_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        'patient',
        (NEW.raw_user_meta_data->>'institution_id')::UUID
    );
    RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE claims
    SET
        status = 'rejected',
        reviewed_by = p_reviewer_id,
        review_notes = p_review_notes,
        reviewed_at = NOW()
    WHERE id = p_claim_id AND status = 'submitted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or not in submitted status';
    END IF;
END;
$$;


ALTER FUNCTION "public"."reject_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") IS 'RPC untuk menyimpan ECDH keypair saat signup. Dipanggil dari client setelah Supabase Auth signup berhasil. Hanya bisa dipakai untuk menyimpan keypair milik caller (auth.uid()).';



CREATE OR REPLACE FUNCTION "public"."update_claim_after_proof_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE claims
    SET status = 'submitted'
    WHERE id = NEW.claim_id AND status = 'proof_generating';
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_claim_after_proof_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") IS 'RPC untuk update encrypted_priv_key saat user ganti password. Harus dipanggil BERSAMAAN dengan Supabase Auth password change. Alurnya: (1) client decrypt priv key pakai password lama, (2) client re-encrypt priv key pakai password baru, (3) panggil update_user_keypair + Supabase Auth updateUser secara concurrent. Public key TIDAK berubah sehingga catatan lama yang sudah dienkripsi tetap bisa dibaca.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_policy_id" "uuid" NOT NULL,
    "medical_record_id" "uuid" NOT NULL,
    "procedure_id" "uuid" NOT NULL,
    "procedure_date" "date" NOT NULL,
    "procedure_date_encoded" integer NOT NULL,
    "claim_amount" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "claims_claim_amount_check" CHECK (("claim_amount" > 0)),
    CONSTRAINT "claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'proof_generating'::"text", 'proof_failed'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "procedure_after_submission" CHECK (("procedure_date" <= ("submitted_at")::"date"))
);


ALTER TABLE "public"."claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diagnoses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "icd10_code" "text" NOT NULL,
    "icd10_integer_encoding" integer NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."diagnoses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "license_number" "text" NOT NULL,
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "institutions_type_check" CHECK (("type" = ANY (ARRAY['hospital'::"text", 'insurance'::"text"])))
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insurance_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "insurance_institution_id" "uuid" NOT NULL,
    "policy_name" "text" NOT NULL,
    "max_coverage_amount" bigint NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date" NOT NULL,
    "approved_diagnosis_root" "text",
    "approved_procedure_root" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_date_range" CHECK (("valid_until" > "valid_from"))
);


ALTER TABLE "public"."insurance_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "hospital_institution_id" "uuid" NOT NULL,
    "diagnosis_id" "uuid" NOT NULL,
    "diagnosis_date" "date" NOT NULL,
    "diagnosis_date_encoded" integer NOT NULL,
    "attending_doctor_id" "uuid" NOT NULL,
    "notes_encrypted" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medical_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "policy_number" "text" NOT NULL,
    "policy_commitment" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_policy_date_range" CHECK (("end_date" > "start_date"))
);


ALTER TABLE "public"."patient_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "nik_hash" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "birth_year" integer NOT NULL,
    "gender" "text" NOT NULL,
    "registered_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hospital_id" "uuid",
    CONSTRAINT "patients_birth_year_check" CHECK ((("birth_year" > 1900) AND ("birth_year" <= (EXTRACT(year FROM "now"()))::integer))),
    CONSTRAINT "patients_gender_check" CHECK (("gender" = ANY (ARRAY['M'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_covered_diagnoses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "diagnosis_id" "uuid" NOT NULL,
    "merkle_leaf_index" integer NOT NULL,
    "merkle_leaf_hash" "text" NOT NULL
);


ALTER TABLE "public"."policy_covered_diagnoses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_covered_procedures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "procedure_id" "uuid" NOT NULL,
    "merkle_leaf_index" integer NOT NULL,
    "merkle_leaf_hash" "text" NOT NULL
);


ALTER TABLE "public"."policy_covered_procedures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."procedures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "icd9_code" "text" NOT NULL,
    "icd9_integer_encoding" integer NOT NULL,
    "description" "text" NOT NULL,
    "default_max_coverage" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."procedures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "institution_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_key" "text",
    "encrypted_priv_key" "text",
    "key_derivation_salt" "text",
    "key_iv" "text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['hospital_staff'::"text", 'insurance_reviewer'::"text", 'patient'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."public_key" IS 'ECDH P-256 public key dalam format SPKI, di-encode base64. Boleh dibaca oleh siapapun (dokter) untuk mengenkripsi notes. NULL berarti user belum generate keypair (bukan pasien, atau signup lama).';



COMMENT ON COLUMN "public"."users"."encrypted_priv_key" IS 'ECDH P-256 private key yang sudah di-wrap menggunakan AES-256-GCM. KEK (Key Encryption Key) di-derive dari password user via PBKDF2. Hanya bisa di-unwrap di browser dengan password user yang benar.';



COMMENT ON COLUMN "public"."users"."key_derivation_salt" IS 'Salt acak (32 bytes, base64) untuk PBKDF2 key derivation. Harus unik per user. Dikirim ke client saat login agar PBKDF2 bisa di-derive ulang.';



COMMENT ON COLUMN "public"."users"."key_iv" IS 'Initialization Vector (12 bytes, base64) untuk AES-GCM. Digunakan bersama masterKey untuk decrypt encrypted_priv_key.';



CREATE TABLE IF NOT EXISTS "public"."zkp_proofs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "proof_json" "jsonb" NOT NULL,
    "public_signals" "jsonb" NOT NULL,
    "verification_result" boolean,
    "proof_generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone
);


ALTER TABLE "public"."zkp_proofs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diagnoses"
    ADD CONSTRAINT "diagnoses_icd10_code_key" UNIQUE ("icd10_code");



ALTER TABLE ONLY "public"."diagnoses"
    ADD CONSTRAINT "diagnoses_icd10_integer_encoding_key" UNIQUE ("icd10_integer_encoding");



ALTER TABLE ONLY "public"."diagnoses"
    ADD CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_license_number_key" UNIQUE ("license_number");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_policies"
    ADD CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_policies"
    ADD CONSTRAINT "patient_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_policies"
    ADD CONSTRAINT "patient_policies_policy_commitment_key" UNIQUE ("policy_commitment");



ALTER TABLE ONLY "public"."patient_policies"
    ADD CONSTRAINT "patient_policies_policy_number_key" UNIQUE ("policy_number");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_nik_hash_key" UNIQUE ("nik_hash");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_covered_diagnoses"
    ADD CONSTRAINT "policy_covered_diagnoses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_covered_diagnoses"
    ADD CONSTRAINT "policy_covered_diagnoses_policy_id_diagnosis_id_key" UNIQUE ("policy_id", "diagnosis_id");



ALTER TABLE ONLY "public"."policy_covered_diagnoses"
    ADD CONSTRAINT "policy_covered_diagnoses_policy_id_merkle_leaf_index_key" UNIQUE ("policy_id", "merkle_leaf_index");



ALTER TABLE ONLY "public"."policy_covered_procedures"
    ADD CONSTRAINT "policy_covered_procedures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_covered_procedures"
    ADD CONSTRAINT "policy_covered_procedures_policy_id_merkle_leaf_index_key" UNIQUE ("policy_id", "merkle_leaf_index");



ALTER TABLE ONLY "public"."policy_covered_procedures"
    ADD CONSTRAINT "policy_covered_procedures_policy_id_procedure_id_key" UNIQUE ("policy_id", "procedure_id");



ALTER TABLE ONLY "public"."procedures"
    ADD CONSTRAINT "procedures_icd9_code_key" UNIQUE ("icd9_code");



ALTER TABLE ONLY "public"."procedures"
    ADD CONSTRAINT "procedures_icd9_integer_encoding_key" UNIQUE ("icd9_integer_encoding");



ALTER TABLE ONLY "public"."procedures"
    ADD CONSTRAINT "procedures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zkp_proofs"
    ADD CONSTRAINT "zkp_proofs_claim_id_key" UNIQUE ("claim_id");



ALTER TABLE ONLY "public"."zkp_proofs"
    ADD CONSTRAINT "zkp_proofs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_actor_id" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_claims_medical_record_id" ON "public"."claims" USING "btree" ("medical_record_id");



CREATE INDEX "idx_claims_patient_policy_id" ON "public"."claims" USING "btree" ("patient_policy_id");



CREATE INDEX "idx_claims_status" ON "public"."claims" USING "btree" ("status");



CREATE INDEX "idx_claims_submitted_at" ON "public"."claims" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_diagnoses_icd10_code" ON "public"."diagnoses" USING "btree" ("icd10_code");



CREATE INDEX "idx_diagnoses_integer_encoding" ON "public"."diagnoses" USING "btree" ("icd10_integer_encoding");



CREATE INDEX "idx_insurance_policies_active" ON "public"."insurance_policies" USING "btree" ("is_active");



CREATE INDEX "idx_insurance_policies_institution" ON "public"."insurance_policies" USING "btree" ("insurance_institution_id");



CREATE INDEX "idx_medical_records_diagnosis_id" ON "public"."medical_records" USING "btree" ("diagnosis_id");



CREATE INDEX "idx_medical_records_hospital" ON "public"."medical_records" USING "btree" ("hospital_institution_id");



CREATE INDEX "idx_medical_records_patient_id" ON "public"."medical_records" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_policies_active" ON "public"."patient_policies" USING "btree" ("is_active");



CREATE INDEX "idx_patient_policies_patient_id" ON "public"."patient_policies" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_policies_policy_id" ON "public"."patient_policies" USING "btree" ("policy_id");



CREATE INDEX "idx_patients_registered_by" ON "public"."patients" USING "btree" ("registered_by");



CREATE INDEX "idx_patients_user_id" ON "public"."patients" USING "btree" ("user_id");



CREATE INDEX "idx_pcd_policy_id" ON "public"."policy_covered_diagnoses" USING "btree" ("policy_id");



CREATE INDEX "idx_pcp_policy_id" ON "public"."policy_covered_procedures" USING "btree" ("policy_id");



CREATE INDEX "idx_procedures_icd9_code" ON "public"."procedures" USING "btree" ("icd9_code");



CREATE INDEX "idx_procedures_integer_encoding" ON "public"."procedures" USING "btree" ("icd9_integer_encoding");



CREATE INDEX "idx_users_institution_id" ON "public"."users" USING "btree" ("institution_id");



CREATE INDEX "idx_users_public_key_not_null" ON "public"."users" USING "btree" ("id") WHERE ("public_key" IS NOT NULL);



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_zkp_proofs_claim_id" ON "public"."zkp_proofs" USING "btree" ("claim_id");



CREATE OR REPLACE TRIGGER "trigger_audit_claim_insert" AFTER INSERT ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."audit_claim_insert"();



CREATE OR REPLACE TRIGGER "trigger_audit_claim_status_change" AFTER UPDATE ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."audit_claim_status_change"();



CREATE OR REPLACE TRIGGER "trigger_audit_proof_insert" AFTER INSERT ON "public"."zkp_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_proof_insert"();



CREATE OR REPLACE TRIGGER "trigger_audit_proof_verification" AFTER UPDATE ON "public"."zkp_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_proof_verification"();



CREATE OR REPLACE TRIGGER "trigger_update_claim_after_proof" AFTER INSERT ON "public"."zkp_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."update_claim_after_proof_insert"();



CREATE OR REPLACE TRIGGER "trigger_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_patient_policy_id_fkey" FOREIGN KEY ("patient_policy_id") REFERENCES "public"."patient_policies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."insurance_policies"
    ADD CONSTRAINT "insurance_policies_insurance_institution_id_fkey" FOREIGN KEY ("insurance_institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_attending_doctor_id_fkey" FOREIGN KEY ("attending_doctor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_hospital_institution_id_fkey" FOREIGN KEY ("hospital_institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_policies"
    ADD CONSTRAINT "patient_policies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_policies"
    ADD CONSTRAINT "patient_policies_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."institutions"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."policy_covered_diagnoses"
    ADD CONSTRAINT "policy_covered_diagnoses_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."policy_covered_diagnoses"
    ADD CONSTRAINT "policy_covered_diagnoses_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_covered_procedures"
    ADD CONSTRAINT "policy_covered_procedures_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_covered_procedures"
    ADD CONSTRAINT "policy_covered_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zkp_proofs"
    ADD CONSTRAINT "zkp_proofs_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_read" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = 'admin'::"text") OR ("actor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("public"."get_user_role"() = ANY (ARRAY['hospital_staff'::"text", 'insurance_reviewer'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "audit_logs"."actor_id") AND ("u"."institution_id" = ( SELECT "users"."institution_id"
           FROM "public"."users"
          WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "claims_insert" ON "public"."claims" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."medical_records" "mr"
  WHERE (("mr"."id" = "claims"."medical_record_id") AND ("mr"."hospital_institution_id" = "public"."get_user_institution_id"()))))));



CREATE POLICY "claims_read" ON "public"."claims" FOR SELECT TO "authenticated" USING (((("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."medical_records" "mr"
  WHERE (("mr"."id" = "claims"."medical_record_id") AND ("mr"."hospital_institution_id" = "public"."get_user_institution_id"()))))) OR (("public"."get_user_role"() = 'insurance_reviewer'::"text") AND ("status" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'rejected'::"text"]))) OR (("public"."get_user_role"() = 'patient'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."patient_policies" "pp"
     JOIN "public"."patients" "p" ON (("p"."id" = "pp"."patient_id")))
  WHERE (("pp"."id" = "claims"."patient_policy_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "claims_update" ON "public"."claims" FOR UPDATE TO "authenticated" USING (((("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."medical_records" "mr"
  WHERE (("mr"."id" = "claims"."medical_record_id") AND ("mr"."hospital_institution_id" = "public"."get_user_institution_id"()))))) OR ("public"."get_user_role"() = 'insurance_reviewer'::"text") OR ("public"."get_user_role"() = 'admin'::"text")));



ALTER TABLE "public"."diagnoses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diagnoses_delete" ON "public"."diagnoses" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "diagnoses_insert" ON "public"."diagnoses" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "diagnoses_read" ON "public"."diagnoses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "diagnoses_update" ON "public"."diagnoses" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "institutions_delete" ON "public"."institutions" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "institutions_insert" ON "public"."institutions" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "institutions_read" ON "public"."institutions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "institutions_update" ON "public"."institutions" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."insurance_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insurance_policies_delete" ON "public"."insurance_policies" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "insurance_policies_insert" ON "public"."insurance_policies" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "insurance_policies_read" ON "public"."insurance_policies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "insurance_policies_update" ON "public"."insurance_policies" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



ALTER TABLE "public"."medical_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "medical_records_insert" ON "public"."medical_records" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_role"() = 'hospital_staff'::"text") AND ("hospital_institution_id" = "public"."get_user_institution_id"())));



CREATE POLICY "medical_records_read" ON "public"."medical_records" FOR SELECT TO "authenticated" USING (((("public"."get_user_role"() = 'hospital_staff'::"text") AND ("hospital_institution_id" = "public"."get_user_institution_id"())) OR (EXISTS ( SELECT 1
   FROM "public"."patients" "p"
  WHERE (("p"."id" = "medical_records"."patient_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "medical_records_update" ON "public"."medical_records" FOR UPDATE TO "authenticated" USING ((("public"."get_user_role"() = 'hospital_staff'::"text") AND ("hospital_institution_id" = "public"."get_user_institution_id"())));



ALTER TABLE "public"."patient_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_policies_read" ON "public"."patient_policies" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])) OR (("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."users" "u" ON (("u"."id" = "p"."registered_by")))
  WHERE (("p"."id" = "patient_policies"."patient_id") AND ("u"."institution_id" = ( SELECT "users"."institution_id"
           FROM "public"."users"
          WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))))))) OR (EXISTS ( SELECT 1
   FROM "public"."patients" "p"
  WHERE (("p"."id" = "patient_policies"."patient_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "patient_policies_write" ON "public"."patient_policies" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'hospital_staff'::"text"));



ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patients_insert" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'hospital_staff'::"text"));



CREATE POLICY "patients_read" ON "public"."patients" FOR SELECT TO "authenticated" USING (((("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "patients"."registered_by") AND ("u"."institution_id" = ( SELECT "users"."institution_id"
           FROM "public"."users"
          WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))))))) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "patients_update" ON "public"."patients" FOR UPDATE TO "authenticated" USING (((("public"."get_user_role"() = 'hospital_staff'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "patients"."registered_by") AND ("u"."institution_id" = ( SELECT "users"."institution_id"
           FROM "public"."users"
          WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))))))) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "pcd_delete" ON "public"."policy_covered_diagnoses" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "pcd_insert" ON "public"."policy_covered_diagnoses" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "pcd_read" ON "public"."policy_covered_diagnoses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pcd_update" ON "public"."policy_covered_diagnoses" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "pcp_delete" ON "public"."policy_covered_procedures" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "pcp_insert" ON "public"."policy_covered_procedures" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "pcp_read" ON "public"."policy_covered_procedures" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pcp_update" ON "public"."policy_covered_procedures" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['insurance_reviewer'::"text", 'admin'::"text"])));



ALTER TABLE "public"."policy_covered_diagnoses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_covered_procedures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."procedures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "procedures_delete" ON "public"."procedures" FOR DELETE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "procedures_insert" ON "public"."procedures" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "procedures_read" ON "public"."procedures" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "procedures_update" ON "public"."procedures" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_all" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."zkp_proofs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zkp_proofs_insert" ON "public"."zkp_proofs" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = 'hospital_staff'::"text"));



CREATE POLICY "zkp_proofs_read" ON "public"."zkp_proofs" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['hospital_staff'::"text", 'insurance_reviewer'::"text", 'admin'::"text"])));



CREATE POLICY "zkp_proofs_update" ON "public"."zkp_proofs" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['hospital_staff'::"text", 'insurance_reviewer'::"text", 'admin'::"text"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."approve_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_claim_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_claim_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_claim_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_claim_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_claim_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_claim_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_proof_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_proof_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_proof_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_proof_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_proof_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_proof_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_policy_with_relations"("p_insurance_institution_id" "uuid", "p_policy_name" "text", "p_max_coverage_amount" numeric, "p_valid_from" timestamp with time zone, "p_valid_until" timestamp with time zone, "p_approved_diagnosis_root" "text", "p_approved_procedure_root" "text", "p_is_active" boolean, "p_diagnoses" "jsonb", "p_procedures" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_policy_with_relations"("p_insurance_institution_id" "uuid", "p_policy_name" "text", "p_max_coverage_amount" numeric, "p_valid_from" timestamp with time zone, "p_valid_until" timestamp with time zone, "p_approved_diagnosis_root" "text", "p_approved_procedure_root" "text", "p_is_active" boolean, "p_diagnoses" "jsonb", "p_procedures" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_policy_with_relations"("p_insurance_institution_id" "uuid", "p_policy_name" "text", "p_max_coverage_amount" numeric, "p_valid_from" timestamp with time zone, "p_valid_until" timestamp with time zone, "p_approved_diagnosis_root" "text", "p_approved_procedure_root" "text", "p_is_active" boolean, "p_diagnoses" "jsonb", "p_procedures" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_claims_paginated"("p_page" integer, "p_limit" integer, "p_sort_by" "text", "p_sort_dir" "text", "p_status" "text", "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_claims_paginated"("p_page" integer, "p_limit" integer, "p_sort_by" "text", "p_sort_dir" "text", "p_status" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_claims_paginated"("p_page" integer, "p_limit" integer, "p_sort_by" "text", "p_sort_dir" "text", "p_status" "text", "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_crypto_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_crypto_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_crypto_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_patient_public_key"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_institution_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_institution_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_institution_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_claim"("p_claim_id" "uuid", "p_reviewer_id" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_user_keypair"("p_public_key" "text", "p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_claim_after_proof_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_claim_after_proof_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_claim_after_proof_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_keypair"("p_encrypted_priv_key" "text", "p_key_derivation_salt" "text", "p_key_iv" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";



GRANT ALL ON TABLE "public"."diagnoses" TO "anon";
GRANT ALL ON TABLE "public"."diagnoses" TO "authenticated";
GRANT ALL ON TABLE "public"."diagnoses" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_policies" TO "anon";
GRANT ALL ON TABLE "public"."insurance_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_policies" TO "service_role";



GRANT ALL ON TABLE "public"."medical_records" TO "anon";
GRANT ALL ON TABLE "public"."medical_records" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_records" TO "service_role";



GRANT ALL ON TABLE "public"."patient_policies" TO "anon";
GRANT ALL ON TABLE "public"."patient_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_policies" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."policy_covered_diagnoses" TO "anon";
GRANT ALL ON TABLE "public"."policy_covered_diagnoses" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_covered_diagnoses" TO "service_role";



GRANT ALL ON TABLE "public"."policy_covered_procedures" TO "anon";
GRANT ALL ON TABLE "public"."policy_covered_procedures" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_covered_procedures" TO "service_role";



GRANT ALL ON TABLE "public"."procedures" TO "anon";
GRANT ALL ON TABLE "public"."procedures" TO "authenticated";
GRANT ALL ON TABLE "public"."procedures" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."zkp_proofs" TO "anon";
GRANT ALL ON TABLE "public"."zkp_proofs" TO "authenticated";
GRANT ALL ON TABLE "public"."zkp_proofs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































