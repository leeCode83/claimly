-- ============================================================
-- RESTORE CLAIMS TABLE
-- Migrasi ini membangun ulang tabel claims beserta semua
-- dependensinya setelah tabel tidak sengaja terhapus.
-- ============================================================

-- ============================================================
-- 1. BUAT TABEL CLAIMS (jika belum ada)
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_policy_id UUID NOT NULL REFERENCES patient_policies(id) ON DELETE RESTRICT,
    medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE RESTRICT,
    procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE RESTRICT,
    procedure_date DATE NOT NULL,
    procedure_date_encoded INTEGER NOT NULL,
    claim_amount BIGINT NOT NULL CHECK (claim_amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'proof_generating', 'proof_failed', 'submitted', 'approved', 'rejected')
    ),
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT procedure_after_submission CHECK (procedure_date <= submitted_at::DATE)
);

-- ============================================================
-- 2. PULIHKAN FK CONSTRAINT PADA zkp_proofs
-- ============================================================
ALTER TABLE zkp_proofs DROP CONSTRAINT IF EXISTS zkp_proofs_claim_id_fkey;
ALTER TABLE zkp_proofs
    ADD CONSTRAINT zkp_proofs_claim_id_fkey
    FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;

-- ============================================================
-- 3. BUAT ULANG INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_claims_patient_policy_id ON claims(patient_policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_medical_record_id ON claims(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at DESC);

-- ============================================================
-- 4. BUAT ULANG TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================

-- Trigger: audit saat claim diinsert
CREATE OR REPLACE FUNCTION audit_claim_insert()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_audit_claim_insert
    AFTER INSERT ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_insert();

-- Trigger: audit saat status claim berubah
CREATE OR REPLACE FUNCTION audit_claim_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER  trigger_audit_claim_status_change
    AFTER UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_status_change();

-- ============================================================
-- 5. AKTIFKAN RLS
-- ============================================================
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. BUAT ULANG RLS POLICIES (state terbaru dari migration
--    20260328103900_fix_rls_performance.sql)
-- ============================================================

-- DROP dulu jika ada sisa policy lama
DROP POLICY IF EXISTS "claims_read_hospital"  ON public.claims;
DROP POLICY IF EXISTS "claims_read_insurance" ON public.claims;
DROP POLICY IF EXISTS "claims_read_patient"   ON public.claims;
DROP POLICY IF EXISTS "claims_read"           ON public.claims;
DROP POLICY IF EXISTS "claims_update_hospital" ON public.claims;
DROP POLICY IF EXISTS "claims_update_insurance" ON public.claims;
DROP POLICY IF EXISTS "claims_update"         ON public.claims;
DROP POLICY IF EXISTS "claims_insert"         ON public.claims;

-- Policy SELECT: gabungan semua role
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

-- Policy INSERT: hanya hospital_staff dari institusi yang sama
CREATE POLICY "claims_insert" ON public.claims
    FOR INSERT TO authenticated
    WITH CHECK (
        get_user_role() = 'hospital_staff'
        AND EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = claims.medical_record_id
            AND mr.hospital_institution_id = get_user_institution_id()
        )
    );

-- Policy UPDATE: hospital_staff dari institusi yang sama atau insurance_reviewer
CREATE POLICY "claims_update" ON public.claims
    FOR UPDATE TO authenticated
    USING (
        (
            get_user_role() = 'hospital_staff'
            AND EXISTS (
                SELECT 1 FROM medical_records mr
                WHERE mr.id = claims.medical_record_id
                AND mr.hospital_institution_id = get_user_institution_id()
            )
        )
        OR get_user_role() = 'insurance_reviewer'
        OR get_user_role() = 'admin'
    );
