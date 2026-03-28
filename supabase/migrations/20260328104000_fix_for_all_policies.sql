-- ============================================================
-- FIX REMAINING 6 multiple_permissive_policies WARNINGS
--
-- Root cause: Policy FOR ALL juga mencakup SELECT, sehingga
-- ketika ada 1 policy FOR SELECT + 1 policy FOR ALL,
-- PostgreSQL menghitung ada 2 policy permissive untuk SELECT.
--
-- Fix: Pecah setiap policy FOR ALL menjadi 3 policy terpisah:
--      FOR INSERT + FOR UPDATE + FOR DELETE
-- Dengan begitu, SELECT hanya memiliki 1 policy yang aktif.
-- ============================================================


-- ============================================================
-- 1. diagnoses
--    Sebelum: diagnoses_write FOR ALL (admin only)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "diagnoses_write" ON public.diagnoses;

CREATE POLICY "diagnoses_insert" ON public.diagnoses
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "diagnoses_update" ON public.diagnoses
    FOR UPDATE TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "diagnoses_delete" ON public.diagnoses
    FOR DELETE TO authenticated
    USING (get_user_role() = 'admin');


-- ============================================================
-- 2. institutions
--    Sebelum: institutions_write FOR ALL (admin only)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "institutions_write" ON public.institutions;

CREATE POLICY "institutions_insert" ON public.institutions
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "institutions_update" ON public.institutions
    FOR UPDATE TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "institutions_delete" ON public.institutions
    FOR DELETE TO authenticated
    USING (get_user_role() = 'admin');


-- ============================================================
-- 3. insurance_policies
--    Sebelum: insurance_policies_write FOR ALL (insurance_reviewer or admin)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "insurance_policies_write" ON public.insurance_policies;

CREATE POLICY "insurance_policies_insert" ON public.insurance_policies
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "insurance_policies_update" ON public.insurance_policies
    FOR UPDATE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "insurance_policies_delete" ON public.insurance_policies
    FOR DELETE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'));


-- ============================================================
-- 4. policy_covered_diagnoses
--    Sebelum: pcd_write FOR ALL (insurance_reviewer or admin)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "pcd_write" ON public.policy_covered_diagnoses;

CREATE POLICY "pcd_insert" ON public.policy_covered_diagnoses
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "pcd_update" ON public.policy_covered_diagnoses
    FOR UPDATE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "pcd_delete" ON public.policy_covered_diagnoses
    FOR DELETE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'));


-- ============================================================
-- 5. policy_covered_procedures
--    Sebelum: pcp_write FOR ALL (insurance_reviewer or admin)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "pcp_write" ON public.policy_covered_procedures;

CREATE POLICY "pcp_insert" ON public.policy_covered_procedures
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "pcp_update" ON public.policy_covered_procedures
    FOR UPDATE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'))
    WITH CHECK (get_user_role() IN ('insurance_reviewer', 'admin'));

CREATE POLICY "pcp_delete" ON public.policy_covered_procedures
    FOR DELETE TO authenticated
    USING (get_user_role() IN ('insurance_reviewer', 'admin'));


-- ============================================================
-- 6. procedures
--    Sebelum: procedures_write FOR ALL (admin only)
--    Sesudah: 3 policy terpisah INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "procedures_write" ON public.procedures;

CREATE POLICY "procedures_insert" ON public.procedures
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "procedures_update" ON public.procedures
    FOR UPDATE TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "procedures_delete" ON public.procedures
    FOR DELETE TO authenticated
    USING (get_user_role() = 'admin');
