-- ============================================================
-- FIX DATA ISOLATION (FILTER BY HOSPITAL_ID)
--
-- Root cause: hospital_staff had broad read/update access to 
--             all patients and patient_policies in the system.
-- Fix: Restrict visibility based on institution_id.
-- ============================================================

-- 1. patients: Restrict staff to their own institution's patients
DROP POLICY IF EXISTS "patients_read" ON public.patients;
CREATE POLICY "patients_read" ON public.patients
    FOR SELECT TO authenticated
    USING (
        (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = patients.registered_by
                AND u.institution_id = (SELECT institution_id FROM users WHERE id = (SELECT auth.uid()))
            )
        )
        OR user_id = (SELECT auth.uid())
        OR get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "patients_update" ON public.patients;
CREATE POLICY "patients_update" ON public.patients
    FOR UPDATE TO authenticated
    USING (
        (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = patients.registered_by
                AND u.institution_id = (SELECT institution_id FROM users WHERE id = (SELECT auth.uid()))
            )
        )
        OR user_id = (SELECT auth.uid())
        OR get_user_role() = 'admin'
    );


-- 2. patient_policies: Restrict staff to policies of their patients
DROP POLICY IF EXISTS "patient_policies_read" ON public.patient_policies;
CREATE POLICY "patient_policies_read" ON public.patient_policies
    FOR SELECT TO authenticated
    USING (
        (
            get_user_role() IN ('insurance_reviewer', 'admin')
        )
        OR (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM patients p
                JOIN users u ON u.id = p.registered_by
                WHERE p.id = patient_policies.patient_id
                AND u.institution_id = (SELECT institution_id FROM users WHERE id = (SELECT auth.uid()))
            )
        )
        OR EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = patient_policies.patient_id
            AND p.user_id = (SELECT auth.uid())
        )
    );


-- 3. users: Allow staff to see colleagues in the same institution
-- This enables doctors to see the list of colleague names for medical records.
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_colleagues" ON public.users
    FOR SELECT TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (
            get_user_role() = 'hospital_staff'
            AND institution_id = (SELECT institution_id FROM users WHERE id = (SELECT auth.uid()))
        )
        OR get_user_role() = 'admin'
    );


-- 4. audit_logs: Restrict staff to their own or their institution's logs
DROP POLICY IF EXISTS "audit_logs_read" ON public.audit_logs;
CREATE POLICY "audit_logs_read" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        actor_id = (SELECT auth.uid())
        OR get_user_role() = 'admin'
        OR (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = audit_logs.actor_id
                AND u.institution_id = (SELECT institution_id FROM users WHERE id = (SELECT auth.uid()))
            )
        )
    );
