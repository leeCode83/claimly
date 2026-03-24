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