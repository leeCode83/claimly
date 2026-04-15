-- ============================================================
-- RLS Policy Update: Insurance Policies per Institution Isolation
--
--	Tujuan: insurance_reviewer hanya bisa INSERT/UPDATE/DELETE
--	polis yang insurance_institution_id-nya sama dengan mereka
--
--	Admin mendapat exception - bisa lakukan semua operasi
-- ============================================================

-- Drop policies yang lama
DROP POLICY IF EXISTS "insurance_policies_insert" ON public.insurance_policies;
DROP POLICY IF EXISTS "insurance_policies_update" ON public.insurance_policies;
DROP POLICY IF EXISTS "insurance_policies_delete" ON public.insurance_policies;

-- INSERT: insurance_reviewer hanya bisa insert polis dgn institusi mereka, admin bisa semua
CREATE POLICY "insurance_policies_insert" ON public.insurance_policies
    FOR INSERT TO authenticated
    WITH CHECK (
        get_user_role() = 'admin' 
        OR (
            get_user_role() = 'insurance_reviewer' 
            AND insurance_institution_id = get_user_institution_id()
        )
    );

-- UPDATE: insurance_reviewer hanya bisa update polis institusi mereka, admin bisa semua
CREATE POLICY "insurance_policies_update" ON public.insurance_policies
    FOR UPDATE TO authenticated
    USING (
        get_user_role() = 'admin' 
        OR (
            get_user_role() = 'insurance_reviewer' 
            AND insurance_institution_id = get_user_institution_id()
        )
    )
    WITH CHECK (
        get_user_role() = 'admin' 
        OR (
            get_user_role() = 'insurance_reviewer' 
            AND insurance_institution_id = get_user_institution_id()
        )
    );

-- DELETE: insurance_reviewer hanya bisa hapus polis institusi mereka, admin bisa semua
CREATE POLICY "insurance_policies_delete" ON public.insurance_policies
    FOR DELETE TO authenticated
    USING (
        get_user_role() = 'admin' 
        OR (
            get_user_role() = 'insurance_reviewer' 
            AND insurance_institution_id = get_user_institution_id()
        )
    );