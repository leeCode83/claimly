import { SupabaseClient } from "@supabase/supabase-js";
import { generateProof, verifyProof, buildMerkleTree, getMerklePath } from "@/service/zkp";

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
        claim_amount: number
    }, submittedBy: string) {
        // Validasi input
        if (!payload.patient_policy_id || !payload.medical_record_id || !payload.procedure_id || !payload.procedure_date || !payload.claim_amount) {
            const err: any = new Error("Semua field wajib diisi: patient_policy_id, medical_record_id, procedure_id, procedure_date, claim_amount");
            err.status = 400;
            throw err;
        }

        const procedure_date_encoded = encodeDate(payload.procedure_date);

        // 1. Insert claim awal dengan status 'pending'
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
            err.status = 400;
            throw err;
        }

        // 2. Set status ke 'proof_generating'
        await this.supabase
            .from('claims')
            .update({ status: 'proof_generating' })
            .eq('id', claim.id);

        try {
            // 3. Kumpulkan semua data untuk ZKP input
            const zkpInput = await this.buildZKPInput(claim.id, payload);

            // 4. Generate ZKP proof
            const { proof, publicSignals } = await generateProof(zkpInput);

            // 5. Insert zkp_proof (trigger DB otomatis ubah status claim ke 'submitted')
            const { error: proofError } = await this.supabase
                .from('zkp_proofs')
                .insert({
                    claim_id: claim.id,
                    proof_json: proof,
                    public_signals: publicSignals
                });

            if (proofError) throw new Error(proofError.message);

            return { ...claim, status: 'submitted' };

        } catch (zkpErr: any) {
            // 6. Jika ZKP gagal, set status ke 'proof_failed'
            await this.supabase
                .from('claims')
                .update({ status: 'proof_failed' })
                .eq('id', claim.id);

            const err: any = new Error(`ZKP proof generation gagal: ${zkpErr.message}`);
            err.status = 500;
            err.claim_id = claim.id;
            throw err;
        }
    }

    private async buildZKPInput(claimId: string, payload: {
        patient_policy_id: string,
        medical_record_id: string,
        procedure_id: string,
        procedure_date: string,
        claim_amount: number
    }) {
        // Ambil data medical record (diagnosis info)
        const { data: medRecord, error: mrError } = await this.supabase
            .from('medical_records')
            .select('*, diagnosis:diagnoses(*)')
            .eq('id', payload.medical_record_id)
            .single();

        if (mrError) throw new Error(`Gagal ambil medical record: ${mrError.message}`);

        // Ambil data patient_policy + insurance_policy
        const { data: patientPolicy, error: ppError } = await this.supabase
            .from('patient_policies')
            .select('*, insurance_policies(*)')
            .eq('id', payload.patient_policy_id)
            .single();

        if (ppError) throw new Error(`Gagal ambil patient policy: ${ppError.message}`);

        const policy = patientPolicy.insurance_policies as any;
        if (!policy) throw new Error('Data insurance policy tidak ditemukan');
        if (!policy.approved_diagnosis_root || !policy.approved_procedure_root) {
            throw new Error('Policy belum memiliki approved_diagnosis_root atau approved_procedure_root');
        }

        // Ambil procedure
        const { data: procedure, error: procError } = await this.supabase
            .from('procedures')
            .select('*')
            .eq('id', payload.procedure_id)
            .single();

        if (procError) throw new Error(`Gagal ambil procedure: ${procError.message}`);

        // Ambil semua leaf diagnosis dari policy untuk Merkle path
        const { data: diagLeaves } = await this.supabase
            .from('policy_covered_diagnoses')
            .select('*, diagnoses(icd10_integer_encoding)')
            .eq('policy_id', policy.id);

        // Ambil semua leaf procedure dari policy untuk Merkle path
        const { data: procLeaves } = await this.supabase
            .from('policy_covered_procedures')
            .select('*, procedures(icd9_integer_encoding)')
            .eq('policy_id', policy.id);

        // Build leaf data untuk getMerklePath
        const diagLeafData = (diagLeaves || []).map((l: any) => ({
            index: l.merkle_leaf_index,
            hash: l.merkle_leaf_hash,
            encoding: l.diagnoses.icd10_integer_encoding
        }));

        const procLeafData = (procLeaves || []).map((l: any) => ({
            index: l.merkle_leaf_index,
            hash: l.merkle_leaf_hash,
            encoding: l.procedures.icd9_integer_encoding
        }));

        // Get Merkle path untuk diagnosis pasien
        const diagMerklePath = await getMerklePath({
            encoding: medRecord.diagnosis.icd10_integer_encoding,
            allLeafData: diagLeafData
        });

        // Get Merkle path untuk prosedur yang diklaim
        const procMerklePath = await getMerklePath({
            encoding: procedure.icd9_integer_encoding,
            allLeafData: procLeafData
        });

        return {
            diagnosisCode: medRecord.diagnosis.icd10_integer_encoding,
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
}
