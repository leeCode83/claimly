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