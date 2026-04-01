import { SupabaseClient } from "@supabase/supabase-js";
import { generateProof, verifyProof, validatePublicSignals, buildMerkleTree, getMerklePath } from "@/service/zkp";

function encodeDate(dateStr: string): number {
    // encode tanggal ke format YYYYMMDD integer
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

export class ClaimService {
    constructor(private supabase: SupabaseClient) {}

    async getClaims({
        page = 1,
        limit = 10,
        sortBy = 'submitted_at',
        sortDir = 'desc',
        status,
        search
    }: {
        page?: number,
        limit?: number,
        sortBy?: string,
        sortDir?: string,
        status?: string,
        search?: string
    }) {
        const { data, error } = await this.supabase.rpc('get_claims_paginated', {
            p_page: page,
            p_limit: limit,
            p_sort_by: sortBy,
            p_sort_dir: sortDir,
            p_status: status || null,
            p_search: search || null
        });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        const total = data?.[0]?.total_count || 0;

        return {
            data,
            meta: {
                total: Number(total),
                page,
                limit,
                total_pages: Math.ceil(Number(total) / limit)
            }
        };
    }

    async submitClaim(payload: {
        patient_policy_id: string,
        medical_record_id: string,
        procedure_id: string,
        procedure_date: string,
        claim_amount: number,
        proof?: any,
        public_signals?: string[]
    }, submittedBy: string) {
        // Validasi input
        if (!payload.patient_policy_id || !payload.medical_record_id || !payload.procedure_id || !payload.procedure_date || !payload.claim_amount) {
            const err: any = new Error("Semua field wajib diisi: patient_policy_id, medical_record_id, procedure_id, procedure_date, claim_amount");
            err.status = 400;
            throw err;
        }

        const procedure_date_encoded = encodeDate(payload.procedure_date);

        // 1. Ambil dependensi data
        const { medRecord, patientPolicy, procedure } = await this.getClaimDependencies(
            payload.medical_record_id,
            payload.patient_policy_id,
            payload.procedure_id
        );
        
        const policyData = patientPolicy.insurance_policies;
        const policy = Array.isArray(policyData) ? policyData[0] : policyData;

        if (!policy || !policy.approved_diagnosis_root || !policy.approved_procedure_root) {
            const err: any = new Error("Polis belum memiliki approved_diagnosis_root atau approved_procedure_root");
            err.status = 400;
            throw err;
        }

        const medDiagnosis = Array.isArray(medRecord.diagnosis) ? medRecord.diagnosis[0] : medRecord.diagnosis;
        if (!medDiagnosis) {
            const err: any = new Error("Medical record tidak memiliki data diagnosa");
            err.status = 400;
            throw err;
        }

        // 2. Pre-Validasi Node.js (sebelum ZKP Generation)
        if (procedure_date_encoded < medRecord.diagnosis_date_encoded) {
             const err: any = new Error("Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.");
             err.status = 400;
             throw err;
        }

        const policyStartEncoded = encodeDate(patientPolicy.start_date);
        const policyEndEncoded = encodeDate(patientPolicy.end_date);
        if (procedure_date_encoded < policyStartEncoded || procedure_date_encoded > policyEndEncoded) {
             const err: any = new Error("Validasi Gagal: Tanggal prosedur di luar masa aktif polis asuransi.");
             err.status = 400;
             throw err;
        }

        if (payload.claim_amount > procedure.default_max_coverage) {
             const err: any = new Error(`Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal (${procedure.default_max_coverage}).`);
             err.status = 400;
             throw err;
        }

        // 3. Insert Data Claim awal dengan status pending
        const { data: claim, error: claimError } = await this.supabase
            .from('claims')
            .insert({
                patient_policy_id: payload.patient_policy_id,
                medical_record_id: payload.medical_record_id,
                procedure_id: payload.procedure_id,
                procedure_date: payload.procedure_date,
                procedure_date_encoded,
                claim_amount: payload.claim_amount,
                status: 'pending',
                submitted_by: submittedBy
            })
            .select()
            .single();

        if (claimError) {
            const err: any = new Error(claimError.message);
            err.status = 500;
            throw err;
        }

        // 4. Verifikasi dan Simpan ZKP Proof jika disediakan oleh client
        if (payload.proof && payload.public_signals) {
            try {
                // 4.1 Validasi Konsistensi Data dengan Public Signals ZKP
                const validation = validatePublicSignals(payload.public_signals, {
                    claimAmount: payload.claim_amount,
                    procedureDate: procedure_date_encoded,
                    approvedDiagnosisRoot: policy.approved_diagnosis_root,
                    approvedProcedureRoot: policy.approved_procedure_root,
                    maxCoverageAmount: procedure.default_max_coverage
                });

                if (!validation.isValid) {
                    const err: any = new Error(`Integritas data ZKP gagal: ${validation.reason}`);
                    err.status = 400;
                    throw err;
                }

                // 4.2 Verifikasi proof secara kriptografis di sisi server
                const { isValid } = await verifyProof({
                    publicSignals: payload.public_signals,
                    proof: payload.proof
                });

                if (!isValid) {
                    const err: any = new Error("Verifikasi ZKP Proof gagal: Bukti tidak valid atau tidak sesuai dengan data klaim.");
                    err.status = 400;
                    throw err;
                }

                const { error: proofError } = await this.supabase
                    .from('zkp_proofs')
                    .insert({
                        claim_id: claim.id,
                        proof_json: payload.proof,
                        public_signals: payload.public_signals
                    });

                if (proofError) {
                    throw new Error(`Gagal menyimpan proof: ${proofError.message}`);
                }

                // 5. Update status claim jadi submitted
                await this.supabase.from('claims').update({ status: 'submitted' }).eq('id', claim.id);
                claim.status = 'submitted';
            } catch (err: any) {
                await this.supabase.from('claims').update({ status: 'Fail generate proof' }).eq('id', claim.id);
                claim.status = 'Fail generate proof';
                throw err;
            }
        }

        return claim;
    }

    public async getZKPPreparationData(payload: {
        patient_policy_id: string,
        medical_record_id: string,
        procedure_id: string,
        procedure_date: string,
        claim_amount: number
    }) {
        // Ambil dependensi data
        const { medRecord, patientPolicy, procedure } = await this.getClaimDependencies(
            payload.medical_record_id,
            payload.patient_policy_id,
            payload.procedure_id
        );
        const policyData = patientPolicy.insurance_policies;
        const policy = Array.isArray(policyData) ? policyData[0] : policyData;

        if (!policy || !policy.approved_diagnosis_root || !policy.approved_procedure_root) {
            const err: any = new Error("Polis belum memiliki approved_diagnosis_root atau approved_procedure_root");
            err.status = 400;
            throw err;
        }

        const medDiagnosis = Array.isArray(medRecord.diagnosis) ? medRecord.diagnosis[0] : medRecord.diagnosis;
        if (!medDiagnosis) {
            const err: any = new Error("Medical record tidak memiliki data diagnosa");
            err.status = 400;
            throw err;
        }

        // Ambil semua leaf diagnosis dan prosedur secara paralel dari policy
        const [diagLeavesRes, procLeavesRes] = await Promise.all([
             this.supabase.from('policy_covered_diagnoses').select('*, diagnoses(icd10_integer_encoding)').eq('policy_id', policy.id),
             this.supabase.from('policy_covered_procedures').select('*, procedures(icd9_integer_encoding)').eq('policy_id', policy.id)
        ]);

        const diagLeaves = diagLeavesRes.data || [];
        const procLeaves = procLeavesRes.data || [];

        // Build leaf data untuk getMerklePath
        const diagLeafData = diagLeaves.map((l: any) => {
            const d = Array.isArray(l.diagnoses) ? l.diagnoses[0] : l.diagnoses;
            return {
                index: l.merkle_leaf_index,
                hash: l.merkle_leaf_hash,
                encoding: d.icd10_integer_encoding
            };
        });

        const procLeafData = procLeaves.map((l: any) => {
            const p = Array.isArray(l.procedures) ? l.procedures[0] : l.procedures;
            return {
                index: l.merkle_leaf_index,
                hash: l.merkle_leaf_hash,
                encoding: p.icd9_integer_encoding
            };
        });

        // Get Merkle path untuk diagnosis pasien
        const diagMerklePath = await getMerklePath({
            encoding: medDiagnosis.icd10_integer_encoding,
            allLeafData: diagLeafData
        });

        // Get Merkle path untuk prosedur yang diklaim
        const procMerklePath = await getMerklePath({
            encoding: procedure.icd9_integer_encoding,
            allLeafData: procLeafData
        });

        return {
            diagnosisCode: medDiagnosis.icd10_integer_encoding,
            diagnosisDate: medRecord.diagnosis_date_encoded,
            diagnosisMerklePath: diagMerklePath.pathElements,
            diagnosisPathIndices: diagMerklePath.pathIndices,
            procedureMerklePath: procMerklePath.pathElements,
            procedurePathIndices: procMerklePath.pathIndices,
            policyStartDate: encodeDate(patientPolicy.start_date),
            policyEndDate: encodeDate(patientPolicy.end_date),
            procedureCode: procedure.icd9_integer_encoding,
            procedureDate: encodeDate(payload.procedure_date),
            claimAmount: payload.claim_amount,
            approvedDiagnosisRoot: policy.approved_diagnosis_root,
            approvedProcedureRoot: policy.approved_procedure_root,
            maxCoverageAmount: procedure.default_max_coverage
        };
    }

    async getClaimById(id: string) {
        const { data: claim, error: claimError } = await this.supabase
            .from('claims')
            .select('*, zkp_proofs(*), procedures(*), patient_policies(*, insurance_policies(*))')
            .eq('id', id)
            .single();

        if (claimError) {
            const err: any = new Error(claimError.message);
            err.status = 404;
            throw err;
        }

        // Auto-verify jika proof ada tapi belum diverifikasi
        const zkpProof = (claim as any).zkp_proofs;
        if (zkpProof && zkpProof.verification_result === null) {
            try {
                // Re-validate consistency before auto-verify
                const policyData = (claim as any).patient_policies?.insurance_policies;
                const policy = Array.isArray(policyData) ? policyData[0] : policyData;
                const procedure = (claim as any).procedures;

                const validation = validatePublicSignals(zkpProof.public_signals, {
                    claimAmount: claim.claim_amount,
                    procedureDate: claim.procedure_date_encoded,
                    approvedDiagnosisRoot: policy.approved_diagnosis_root,
                    approvedProcedureRoot: policy.approved_procedure_root,
                    maxCoverageAmount: procedure.default_max_coverage
                });

                if (!validation.isValid) {
                    throw new Error(validation.reason);
                }

                const { isValid } = await verifyProof({
                    proof: zkpProof.proof_json,
                    publicSignals: zkpProof.public_signals
                });

                await this.supabase
                    .from('zkp_proofs')
                    .update({
                        verification_result: isValid,
                        verified_at: new Date().toISOString()
                    })
                    .eq('id', zkpProof.id);

                zkpProof.verification_result = isValid;
                zkpProof.verified_at = new Date().toISOString();
            } catch {
                // Jika verifikasi gagal, biarkan verification_result tetap null
            }
        }

        return claim;
    }

    async approveClaim(claimId: string, reviewerId: string, reviewNotes?: string) {
        // Fetch claim with proof for validation
        const { data: claim, error: fetchError } = await this.supabase
            .from('claims')
            .select('*, zkp_proofs(*)')
            .eq('id', claimId)
            .single();

        if (fetchError || !claim) {
            const err: any = new Error("Klaim tidak ditemukan");
            err.status = 404;
            throw err;
        }

        const zkpProof = (claim as any).zkp_proofs;
        if (!zkpProof) {
            const err: any = new Error("Klaim tidak dapat disetujui tanpa ZKP proof");
            err.status = 400;
            throw err;
        }

        // Auto-verify if null
        let isValid = zkpProof.verification_result;
        if (isValid === null) {
            try {
                // Fetch full claim data for consistency check
                const fullClaim = await this.getClaimById(claimId);
                const policyData = (fullClaim as any).patient_policies?.insurance_policies;
                const policy = Array.isArray(policyData) ? policyData[0] : policyData;
                const proc = (fullClaim as any).procedures;

                const validation = validatePublicSignals(zkpProof.public_signals, {
                    claimAmount: fullClaim.claim_amount,
                    procedureDate: fullClaim.procedure_date_encoded,
                    approvedDiagnosisRoot: policy.approved_diagnosis_root,
                    approvedProcedureRoot: policy.approved_procedure_root,
                    maxCoverageAmount: proc.default_max_coverage
                });

                if (!validation.isValid) {
                    const err: any = new Error(`Integritas Proof Gagal: ${validation.reason}`);
                    err.status = 400;
                    throw err;
                }

                const result = await verifyProof({
                    proof: zkpProof.proof_json,
                    publicSignals: zkpProof.public_signals
                });
                isValid = result.isValid;

                await this.supabase
                    .from('zkp_proofs')
                    .update({
                        verification_result: isValid,
                        verified_at: new Date().toISOString()
                    })
                    .eq('id', zkpProof.id);
            } catch (vErr: any) {
                const err: any = new Error(`Gagal memverifikasi ZKP proof: ${vErr.message}`);
                err.status = 500;
                throw err;
            }
        }

        if (!isValid) {
            const err: any = new Error("Klaim tidak dapat disetujui: ZKP proof tidak valid (verifikasi gagal)");
            err.status = 400;
            throw err;
        }

        const { error } = await this.supabase.rpc('approve_claim', {
            p_claim_id: claimId,
            p_reviewer_id: reviewerId,
            p_review_notes: reviewNotes || null
        });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return { claim_id: claimId, status: 'approved' };
    }

    async rejectClaim(claimId: string, reviewerId: string, reviewNotes: string) {
        if (!reviewNotes || reviewNotes.trim() === '') {
            const err: any = new Error("review_notes wajib diisi saat menolak klaim");
            err.status = 400;
            throw err;
        }

        const { error } = await this.supabase.rpc('reject_claim', {
            p_claim_id: claimId,
            p_reviewer_id: reviewerId,
            p_review_notes: reviewNotes
        });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return { claim_id: claimId, status: 'rejected' };
    }

    private async getClaimDependencies(medical_record_id: string, patient_policy_id: string, procedure_id: string) {
        const [mrRes, ppRes, procRes] = await Promise.all([
            this.supabase.from('medical_records')
                .select('diagnosis_date_encoded, diagnosis:diagnoses(icd10_integer_encoding)')
                .eq('id', medical_record_id).single(),
            this.supabase.from('patient_policies')
                .select('start_date, end_date, insurance_policies(id, approved_diagnosis_root, approved_procedure_root)')
                .eq('id', patient_policy_id).single(),
            this.supabase.from('procedures')
                .select('icd9_integer_encoding, default_max_coverage')
                .eq('id', procedure_id).single()
        ]);

        if (mrRes.error) { const err: any = new Error(`Gagal ambil medical record: ${mrRes.error.message}`); err.status = 404; throw err; }
        if (ppRes.error) { const err: any = new Error(`Gagal ambil patient policy: ${ppRes.error.message}`); err.status = 404; throw err; }
        if (procRes.error) { const err: any = new Error(`Gagal ambil procedure: ${procRes.error.message}`); err.status = 404; throw err; }

        return {
            medRecord: mrRes.data,
            patientPolicy: ppRes.data,
            procedure: procRes.data
        };
    }
}
