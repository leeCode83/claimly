export interface Claim {
    id: string;
    patient_policy_id: string;
    medical_record_id: string;
    procedure_id: string;
    procedure_date: string;
    procedure_date_encoded: number;
    claim_amount: number;
    status: string;
    submitted_by: string;
    submitted_at: string;
    zkp_proofs?: ZkpProof | ZkpProof[];
    patient_policies?: PatientPolicy;
    procedures?: Procedure;
}

export interface ZkpProof {
    id: string;
    claim_id: string;
    proof_json: unknown;
    public_signals: string[];
    verification_result: boolean | null;
    verified_at?: string;
}

export interface Procedure {
    id: string;
    icd9_integer_encoding: number;
    default_max_coverage: number;
}

export interface PatientPolicy {
    id: string;
    start_date: string;
    end_date: string;
    insurance_policies: InsurancePolicy | InsurancePolicy[];
}

export interface InsurancePolicy {
    id: string;
    insurance_institution_id: string;
    policy_name: string;
    max_coverage_amount: number;
    valid_from: string;
    valid_until: string;
    approved_diagnosis_root: string;
    approved_procedure_root: string;
    is_active: boolean;
    created_at: string;
    covered_diagnoses: {
        icd10_code: string;
        description: string;
    }[];
    covered_procedures: {
        icd9_code: string;
        description: string;
    }[];
}

export interface MedicalRecord {
    diagnosis_date_encoded: number;
    diagnosis: { icd10_integer_encoding: number } | { icd10_integer_encoding: number }[];
}
