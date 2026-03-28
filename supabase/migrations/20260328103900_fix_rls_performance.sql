-- ============================================================
-- FIX RLS PERFORMANCE ISSUES
-- Resolves 16 warnings from Supabase Database Linter:
--   1. auth_rls_initplan   (7 warnings) — wrap auth.uid() with SELECT
--   2. multiple_permissive_policies (9 warnings) — merge duplicate policies
-- ============================================================


-- ============================================================
-- BAGIAN 1: FIX auth_rls_initplan
-- Masalah: auth.uid() dievaluasi ulang tiap baris.
-- Fix: Wrap dengan (SELECT auth.uid()) agar di-cache sekali per query.
-- ============================================================

-- ---- users: users_read_own ----
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
    FOR SELECT TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR get_user_role() = 'admin'
    );

-- ---- users: users_update_own ----
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()));

-- ---- patients: patients_read ----
DROP POLICY IF EXISTS "patients_read" ON public.patients;
CREATE POLICY "patients_read" ON public.patients
    FOR SELECT TO authenticated
    USING (
        get_user_role() = 'hospital_staff'
        OR user_id = (SELECT auth.uid())
        OR get_user_role() = 'admin'
    );

-- ---- patients: patients_update_patient (dari migration latest_update) ----
DROP POLICY IF EXISTS "patients_update_patient" ON public.patients;
-- Catatan: policy ini akan digabung di Bagian 2 (multiple_permissive_policies)

-- ---- patient_policies: patient_policies_read ----
DROP POLICY IF EXISTS "patient_policies_read" ON public.patient_policies;
CREATE POLICY "patient_policies_read" ON public.patient_policies
    FOR SELECT TO authenticated
    USING (
        get_user_role() IN ('hospital_staff', 'insurance_reviewer', 'admin')
        OR EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = patient_policies.patient_id
            AND p.user_id = (SELECT auth.uid())
        )
    );

-- ---- medical_records: medical_records_read ----
DROP POLICY IF EXISTS "medical_records_read" ON public.medical_records;
CREATE POLICY "medical_records_read" ON public.medical_records
    FOR SELECT TO authenticated
    USING (
        (
            get_user_role() = 'hospital_staff'
            AND hospital_institution_id = get_user_institution_id()
        )
        OR EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = medical_records.patient_id
            AND p.user_id = (SELECT auth.uid())
        )
        OR get_user_role() = 'admin'
    );

-- ---- claims: claims_read_patient ----
DROP POLICY IF EXISTS "claims_read_patient" ON public.claims;
-- Catatan: policy ini akan digabung di Bagian 2 (multiple_permissive_policies)


-- ============================================================
-- BAGIAN 2: FIX multiple_permissive_policies
-- Masalah: Banyak policy permissive untuk role+aksi yang sama.
-- Fix: Drop semua policy lama, buat satu policy gabungan per tabel+aksi.
-- ============================================================

-- ---- claims: SELECT — gabung claims_read_hospital + claims_read_insurance + claims_read_patient ----
DROP POLICY IF EXISTS "claims_read_hospital" ON public.claims;
DROP POLICY IF EXISTS "claims_read_insurance" ON public.claims;
DROP POLICY IF EXISTS "claims_read_patient" ON public.claims;
CREATE POLICY "claims_read" ON public.claims
    FOR SELECT TO authenticated
    USING (
        -- hospital_staff: baca klaim dari institusi mereka
        (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM medical_records mr
                WHERE mr.id = claims.medical_record_id
                AND mr.hospital_institution_id = get_user_institution_id()
            )
        )
        -- insurance_reviewer: baca klaim yang sudah disubmit/diproses
        OR (
            get_user_role() = 'insurance_reviewer'
            AND status IN ('submitted', 'approved', 'rejected')
        )
        -- patient: baca klaim milik sendiri
        OR (
            get_user_role() = 'patient'
            AND EXISTS (
                SELECT 1 FROM patient_policies pp
                JOIN patients p ON p.id = pp.patient_id
                WHERE pp.id = claims.patient_policy_id
                AND p.user_id = (SELECT auth.uid())
            )
        )
        -- admin: baca semua
        OR get_user_role() = 'admin'
    );

-- ---- claims: UPDATE — gabung claims_update_hospital + claims_update_insurance ----
DROP POLICY IF EXISTS "claims_update_hospital" ON public.claims;
DROP POLICY IF EXISTS "claims_update_insurance" ON public.claims;
CREATE POLICY "claims_update" ON public.claims
    FOR UPDATE TO authenticated
    USING (
        -- hospital_staff: hanya bisa update klaim dari institusi mereka
        (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM medical_records mr
                WHERE mr.id = claims.medical_record_id
                AND mr.hospital_institution_id = get_user_institution_id()
            )
        )
        -- insurance_reviewer: bisa update status klaim
        OR get_user_role() = 'insurance_reviewer'
    );

-- ---- patients: UPDATE — gabung patients_update + patients_update_patient ----
DROP POLICY IF EXISTS "patients_update" ON public.patients;
CREATE POLICY "patients_update" ON public.patients
    FOR UPDATE TO authenticated
    USING (
        -- hospital_staff: bisa update data pasien
        get_user_role() = 'hospital_staff'
        -- patient: hanya bisa update profil dirinya sendiri
        OR user_id = (SELECT auth.uid())
    );

-- ---- diagnoses: SELECT — gabung diagnoses_read + diagnoses_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "diagnoses_read" ON public.diagnoses;
DROP POLICY IF EXISTS "diagnoses_write" ON public.diagnoses;
CREATE POLICY "diagnoses_read" ON public.diagnoses
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "diagnoses_write" ON public.diagnoses
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- ---- institutions: SELECT — gabung institutions_read + institutions_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "institutions_read" ON public.institutions;
DROP POLICY IF EXISTS "institutions_write" ON public.institutions;
CREATE POLICY "institutions_read" ON public.institutions
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "institutions_write" ON public.institutions
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- ---- insurance_policies: SELECT — gabung insurance_policies_read + insurance_policies_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "insurance_policies_read" ON public.insurance_policies;
DROP POLICY IF EXISTS "insurance_policies_write" ON public.insurance_policies;
CREATE POLICY "insurance_policies_read" ON public.insurance_policies
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "insurance_policies_write" ON public.insurance_policies
    FOR ALL TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

-- ---- policy_covered_diagnoses: SELECT — gabung pcd_read + pcd_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "pcd_read" ON public.policy_covered_diagnoses;
DROP POLICY IF EXISTS "pcd_write" ON public.policy_covered_diagnoses;
CREATE POLICY "pcd_read" ON public.policy_covered_diagnoses
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "pcd_write" ON public.policy_covered_diagnoses
    FOR ALL TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

-- ---- policy_covered_procedures: SELECT — gabung pcp_read + pcp_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "pcp_read" ON public.policy_covered_procedures;
DROP POLICY IF EXISTS "pcp_write" ON public.policy_covered_procedures;
CREATE POLICY "pcp_read" ON public.policy_covered_procedures
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "pcp_write" ON public.policy_covered_procedures
    FOR ALL TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

-- ---- procedures: SELECT — gabung procedures_read + procedures_write (FOR ALL mencakup SELECT) ----
DROP POLICY IF EXISTS "procedures_read" ON public.procedures;
DROP POLICY IF EXISTS "procedures_write" ON public.procedures;
CREATE POLICY "procedures_read" ON public.procedures
    FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "procedures_write" ON public.procedures
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');
