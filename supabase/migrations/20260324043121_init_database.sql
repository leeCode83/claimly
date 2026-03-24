-- ============================================================
-- ZK-InsuranceClaim: Complete Database Schema
-- Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. INSTITUTIONS
-- ============================================================
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('hospital', 'insurance')),
    license_number TEXT NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. USERS (extension dari auth.users Supabase)
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('hospital_staff', 'insurance_reviewer', 'patient', 'admin')),
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. DIAGNOSES (master data ICD-10)
-- ============================================================
CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icd10_code TEXT NOT NULL UNIQUE,
    icd10_integer_encoding INTEGER NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. PROCEDURES (master data ICD-9-CM)
-- ============================================================
CREATE TABLE procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icd9_code TEXT NOT NULL UNIQUE,
    icd9_integer_encoding INTEGER NOT NULL UNIQUE,
    description TEXT NOT NULL,
    default_max_coverage BIGINT NOT NULL DEFAULT 0,
    valid_diagnosis_encodings INTEGER[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. INSURANCE POLICIES
-- ============================================================
CREATE TABLE insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insurance_institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
    policy_name TEXT NOT NULL,
    max_coverage_amount BIGINT NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    approved_diagnosis_root TEXT,
    approved_procedure_root TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (valid_until > valid_from)
);

-- ============================================================
-- 6. POLICY COVERED DIAGNOSES (leaf data Diagnosis Merkle Tree)
-- ============================================================
CREATE TABLE policy_covered_diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id) ON DELETE RESTRICT,
    merkle_leaf_index INTEGER NOT NULL,
    merkle_leaf_hash TEXT NOT NULL,
    UNIQUE (policy_id, diagnosis_id),
    UNIQUE (policy_id, merkle_leaf_index)
);

-- ============================================================
-- 7. POLICY COVERED PROCEDURES (leaf data Procedure Merkle Tree)
-- ============================================================
CREATE TABLE policy_covered_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE RESTRICT,
    merkle_leaf_index INTEGER NOT NULL,
    merkle_leaf_hash TEXT NOT NULL,
    UNIQUE (policy_id, procedure_id),
    UNIQUE (policy_id, merkle_leaf_index)
);

-- ============================================================
-- 8. PATIENTS
-- ============================================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    nik_hash TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    birth_year INTEGER NOT NULL CHECK (birth_year > 1900 AND birth_year <= EXTRACT(YEAR FROM NOW())::INTEGER),
    gender TEXT NOT NULL CHECK (gender IN ('M', 'F')),
    registered_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. PATIENT POLICIES (junction table patients <-> insurance_policies)
-- ============================================================
CREATE TABLE patient_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
    policy_number TEXT NOT NULL UNIQUE,
    policy_commitment TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_policy_date_range CHECK (end_date > start_date)
);

-- ============================================================
-- 10. MEDICAL RECORDS
-- ============================================================
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    hospital_institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id) ON DELETE RESTRICT,
    diagnosis_date DATE NOT NULL,
    diagnosis_date_encoded INTEGER NOT NULL,
    attending_doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes_encrypted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. CLAIMS
-- ============================================================
CREATE TABLE claims (
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
-- 12. ZKP PROOFS
-- ============================================================
CREATE TABLE zkp_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
    proof_json JSONB NOT NULL,
    public_signals JSONB NOT NULL,
    verification_result BOOLEAN,
    proof_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

-- ============================================================
-- 13. AUDIT LOGS (append-only)
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_institution_id ON users(institution_id);

-- diagnoses & procedures
CREATE INDEX idx_diagnoses_icd10_code ON diagnoses(icd10_code);
CREATE INDEX idx_diagnoses_integer_encoding ON diagnoses(icd10_integer_encoding);
CREATE INDEX idx_procedures_icd9_code ON procedures(icd9_code);
CREATE INDEX idx_procedures_integer_encoding ON procedures(icd9_integer_encoding);

-- insurance_policies
CREATE INDEX idx_insurance_policies_institution ON insurance_policies(insurance_institution_id);
CREATE INDEX idx_insurance_policies_active ON insurance_policies(is_active);

-- policy_covered_diagnoses & procedures
CREATE INDEX idx_pcd_policy_id ON policy_covered_diagnoses(policy_id);
CREATE INDEX idx_pcp_policy_id ON policy_covered_procedures(policy_id);

-- patients
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_registered_by ON patients(registered_by);

-- patient_policies
CREATE INDEX idx_patient_policies_patient_id ON patient_policies(patient_id);
CREATE INDEX idx_patient_policies_policy_id ON patient_policies(policy_id);
CREATE INDEX idx_patient_policies_active ON patient_policies(is_active);

-- medical_records
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_hospital ON medical_records(hospital_institution_id);
CREATE INDEX idx_medical_records_diagnosis_id ON medical_records(diagnosis_id);

-- claims
CREATE INDEX idx_claims_patient_policy_id ON claims(patient_policy_id);
CREATE INDEX idx_claims_medical_record_id ON claims(medical_record_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_submitted_at ON claims(submitted_at DESC);

-- zkp_proofs
CREATE INDEX idx_zkp_proofs_claim_id ON zkp_proofs(claim_id);

-- audit_logs
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);


-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto update updated_at pada tabel users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto insert audit log saat claim diinsert
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_claim_insert
    AFTER INSERT ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_insert();

-- Auto insert audit log saat status claim berubah
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_claim_status_change
    AFTER UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_status_change();

-- Auto update claim status ke 'submitted' saat proof berhasil diinsert
CREATE OR REPLACE FUNCTION update_claim_after_proof_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE claims
    SET status = 'submitted'
    WHERE id = NEW.claim_id AND status = 'proof_generating';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_claim_after_proof
    AFTER INSERT ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION update_claim_after_proof_insert();

-- Auto insert audit log saat proof digenerate
CREATE OR REPLACE FUNCTION audit_proof_insert()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_proof_insert
    AFTER INSERT ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION audit_proof_insert();

-- Auto insert audit log saat proof diverifikasi
CREATE OR REPLACE FUNCTION audit_proof_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.verification_result IS NULL AND NEW.verification_result IS NOT NULL THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            NULL,
            'PROOF_VERIFIED',
            'zkp_proofs',
            NEW.id,
            jsonb_build_object(
                'claim_id', NEW.claim_id,
                'verification_result', NEW.verification_result
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_proof_verification
    AFTER UPDATE ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION audit_proof_verification();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_covered_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_covered_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE zkp_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function untuk ambil role dari JWT
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM users WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function untuk ambil institution_id dari JWT
CREATE OR REPLACE FUNCTION get_user_institution_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT institution_id FROM users WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- institutions: semua authenticated user bisa read, hanya admin yang bisa write
CREATE POLICY "institutions_read" ON institutions
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "institutions_write" ON institutions
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- users: user hanya bisa lihat dan edit profilnya sendiri, admin bisa lihat semua
CREATE POLICY "users_read_own" ON users
    FOR SELECT TO authenticated USING (
        id = auth.uid() OR get_user_role() = 'admin'
    );
CREATE POLICY "users_update_own" ON users
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- diagnoses & procedures: semua authenticated user bisa read, hanya admin yang bisa write
CREATE POLICY "diagnoses_read" ON diagnoses
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "diagnoses_write" ON diagnoses
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

CREATE POLICY "procedures_read" ON procedures
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "procedures_write" ON procedures
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- insurance_policies: semua bisa read, hanya insurance_reviewer yang bisa write
CREATE POLICY "insurance_policies_read" ON insurance_policies
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "insurance_policies_write" ON insurance_policies
    FOR ALL TO authenticated USING (get_user_role() = 'insurance_reviewer');

-- policy_covered_diagnoses & procedures: semua bisa read, hanya insurance_reviewer yang bisa write
CREATE POLICY "pcd_read" ON policy_covered_diagnoses
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "pcd_write" ON policy_covered_diagnoses
    FOR ALL TO authenticated USING (get_user_role() = 'insurance_reviewer');

CREATE POLICY "pcp_read" ON policy_covered_procedures
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "pcp_write" ON policy_covered_procedures
    FOR ALL TO authenticated USING (get_user_role() = 'insurance_reviewer');

-- patients: hospital_staff dari institusi yang sama, atau pasien itu sendiri
CREATE POLICY "patients_read" ON patients
    FOR SELECT TO authenticated USING (
        get_user_role() = 'hospital_staff'
        OR user_id = auth.uid()
        OR get_user_role() = 'admin'
    );
CREATE POLICY "patients_insert" ON patients
    FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'hospital_staff');
CREATE POLICY "patients_update" ON patients
    FOR UPDATE TO authenticated USING (get_user_role() = 'hospital_staff');

-- patient_policies: hospital_staff, pasien pemilik, atau insurance_reviewer
CREATE POLICY "patient_policies_read" ON patient_policies
    FOR SELECT TO authenticated USING (
        get_user_role() IN ('hospital_staff', 'insurance_reviewer', 'admin')
        OR EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = patient_policies.patient_id
            AND p.user_id = auth.uid()
        )
    );
CREATE POLICY "patient_policies_write" ON patient_policies
    FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'hospital_staff');

-- medical_records: HANYA hospital_staff dari institusi yang sama, atau pasien pemilik
CREATE POLICY "medical_records_read" ON medical_records
    FOR SELECT TO authenticated USING (
        (
            get_user_role() = 'hospital_staff'
            AND hospital_institution_id = get_user_institution_id()
        )
        OR EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = medical_records.patient_id
            AND p.user_id = auth.uid()
        )
        OR get_user_role() = 'admin'
    );
CREATE POLICY "medical_records_insert" ON medical_records
    FOR INSERT TO authenticated WITH CHECK (
        get_user_role() = 'hospital_staff'
        AND hospital_institution_id = get_user_institution_id()
    );

-- claims: hospital_staff bisa insert & read milik institusinya,
--         insurance_reviewer bisa read & update status,
--         patient hanya bisa read status klaimnya sendiri
CREATE POLICY "claims_read_hospital" ON claims
    FOR SELECT TO authenticated USING (
        get_user_role() = 'hospital_staff'
        AND EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = claims.medical_record_id
            AND mr.hospital_institution_id = get_user_institution_id()
        )
    );
CREATE POLICY "claims_read_insurance" ON claims
    FOR SELECT TO authenticated USING (
        get_user_role() = 'insurance_reviewer'
        AND status IN ('submitted', 'approved', 'rejected')
    );
CREATE POLICY "claims_read_patient" ON claims
    FOR SELECT TO authenticated USING (
        get_user_role() = 'patient'
        AND EXISTS (
            SELECT 1 FROM patient_policies pp
            JOIN patients p ON p.id = pp.patient_id
            WHERE pp.id = claims.patient_policy_id
            AND p.user_id = auth.uid()
        )
    );
CREATE POLICY "claims_insert" ON claims
    FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'hospital_staff');
CREATE POLICY "claims_update_insurance" ON claims
    FOR UPDATE TO authenticated USING (get_user_role() = 'insurance_reviewer');

-- zkp_proofs: hospital_staff dan insurance_reviewer bisa read, tidak ada yang bisa insert via client
CREATE POLICY "zkp_proofs_read" ON zkp_proofs
    FOR SELECT TO authenticated USING (
        get_user_role() IN ('hospital_staff', 'insurance_reviewer', 'admin')
    );

-- audit_logs: semua authenticated user bisa read, tidak ada yang bisa write via client
CREATE POLICY "audit_logs_read" ON audit_logs
    FOR SELECT TO authenticated USING (TRUE);


-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Approve klaim dalam satu atomic transaction
CREATE OR REPLACE FUNCTION approve_claim(
    p_claim_id UUID,
    p_reviewer_id UUID,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject klaim dalam satu atomic transaction
CREATE OR REPLACE FUNCTION reject_claim(
    p_claim_id UUID,
    p_reviewer_id UUID,
    p_review_notes TEXT
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get claims dengan pagination, sort, dan search
CREATE OR REPLACE FUNCTION get_claims_paginated(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10,
    p_sort_by TEXT DEFAULT 'submitted_at',
    p_sort_dir TEXT DEFAULT 'desc',
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    claim_id UUID,
    procedure_code TEXT,
    procedure_description TEXT,
    procedure_date DATE,
    claim_amount BIGINT,
    status TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    policy_commitment TEXT,
    total_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;