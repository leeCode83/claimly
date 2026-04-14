import { SupabaseClient } from "@supabase/supabase-js";
import { verifyProof, validatePublicSignals, getMerklePath } from "@/service/zkp";
import { AppError } from "@/types/common.types";
import { 
    Claim, 
    ZkpProof, 
    Procedure, 
    InsurancePolicy, 
    MedicalRecord 
} from "@/types/claim.types";
import { encodeDate } from "@/lib/utils";
import { enqueueVerification } from "@/lib/queue-helpers";

export class ClaimService {
    constructor(private supabase: SupabaseClient) {}

    async getClaims({
        page = 1,
        limit = 10,
        sortBy = 'submitted_at',
        sortDir = 'desc',
        status,
        search,
        patient_policy_id
    }: {
        page?: number,
        limit?: number,
        sortBy?: string,
        sortDir?: string,
        status?: string,
        search?: string,
        patient_policy_id?: string
    }) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Query untuk mengambil data claim dan nominal
        let query = this.supabase
            .from('claims')
            .select(`
                id,
                procedure_id,
                claim_amount,
                submitted_at,
                status,
                procedures:procedure_id!inner(description, icd9_code)
            `, { count: 'exact' });

        // Filter berdasarkan status (exact match)
        if (status) {
            query = query.eq('status', status);
        }

        // Search berdasarkan deskripsi prosedur (sesuai implementasi sebelumnya)
        if (search) {
            query = query.ilike('procedures.description', `%${search}%`);
        }

        // Filter berdasarkan patient_policy_id
        if (patient_policy_id) {
            query = query.eq('patient_policy_id', patient_policy_id);
        }

        const { data, error, count } = await query
            .order(sortBy, { ascending: sortDir === 'asc' })
            .range(from, to);

        if (error) {
            const err = new Error(error.message) as AppError;
            err.status = 500;
            throw err;
        }

        // Mapping data (Disederhanakan tanpa Nama RS):
        // 1. claim_id, 2. procedure_id, 3. claim_amount, 4. submitted_at, 5. Status, 6. procedure_code
        const formattedData = data?.map(item => {
            const procedure = item.procedures as any;
            return {
                claim_id: item.id,
                procedure_id: item.procedure_id,
                procedure_code: procedure?.icd9_code,
                claim_amount: item.claim_amount,
                submitted_at: item.submitted_at,
                status: item.status
            };
        });

        return {
            data: formattedData,
            meta: {
                total: Number(count || 0),
                page,
                limit,
                total_pages: Math.ceil(Number(count || 0) / limit)
            }
        };
    }

    async submitClaim(payload: {
        patient_policy_id: string,
        medical_record_id: string,
        procedure_id: string,
        procedure_date: string,
        claim_amount: number,
        proof?: unknown,
        public_signals?: string[]
    }, submittedBy: string) {
        // Validasi input
        if (!payload.patient_policy_id || !payload.medical_record_id || !payload.procedure_id || !payload.procedure_date || !payload.claim_amount) {
            const err = new Error("Semua field wajib diisi: patient_policy_id, medical_record_id, procedure_id, procedure_date, claim_amount") as AppError;
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
            const err = new Error("Polis belum memiliki approved_diagnosis_root atau approved_procedure_root") as AppError;
            err.status = 400;
            throw err;
        }

        const medDiagnosis = Array.isArray(medRecord.diagnosis) ? medRecord.diagnosis[0] : medRecord.diagnosis;
        if (!medDiagnosis) {
            const err = new Error("Medical record tidak memiliki data diagnosa") as AppError;
            err.status = 400;
            throw err;
        }

        // 2. Pre-Validasi Node.js (sebelum ZKP Generation)
        if (procedure_date_encoded < medRecord.diagnosis_date_encoded) {
             const err = new Error("Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.") as AppError;
             err.status = 400;
             throw err;
        }

        const policyStartEncoded = encodeDate(patientPolicy.start_date);
        const policyEndEncoded = encodeDate(patientPolicy.end_date);
        if (procedure_date_encoded < policyStartEncoded || procedure_date_encoded > policyEndEncoded) {
             const err = new Error("Validasi Gagal: Tanggal prosedur di luar masa aktif polis asuransi.") as AppError;
             err.status = 400;
             throw err;
        }

        if (payload.claim_amount > procedure.default_max_coverage) {
             const err = new Error(`Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal (${procedure.default_max_coverage}).`) as AppError;
             err.status = 400;
             throw err;
        }

        // 3. Tentukan status awal berdasarkan ketersediaan proof
        const hasZkp = !!(payload.proof && payload.public_signals);
        const initialStatus = hasZkp ? 'submitted' : 'pending';

        // 4. Insert Data Claim
        const { data: claim, error: claimError } = await this.supabase
            .from('claims')
            .insert({
                patient_policy_id: payload.patient_policy_id,
                medical_record_id: payload.medical_record_id,
                procedure_id: payload.procedure_id,
                procedure_date: payload.procedure_date,
                procedure_date_encoded,
                claim_amount: payload.claim_amount,
                status: initialStatus,
                submitted_by: submittedBy
            })
            .select()
            .single();

        if (claimError) {
            const err = new Error(claimError.message) as AppError;
            err.status = 500;
            throw err;
        }

        // 5. Simpan ZKP Proof jika disediakan
        if (hasZkp) {
            try {
                await this.saveProof(
                    claim.id,
                    {
                        proof: payload.proof!,
                        public_signals: payload.public_signals!,
                        claim_amount: payload.claim_amount
                    },
                    procedure_date_encoded,
                    policy,
                    procedure
                );
            } catch (err) {
                // saveProof internal sudah melakukan update status ke 'Fail generate proof'
                // tapi kita pastikan error dilempar agar client tahu
                throw err;
            }
        }

        return claim;
    }

    /**
     * Submit proof for an existing claim that is in 'pending' status.
     * Used in two-step submission: (1) create claim, (2) submit proof later.
     */
    async submitClaimProof(claimId: string, payload: {
        proof: unknown,
        public_signals: string[]
    }) {
        // 1. Fetch claim to verify status and get dependencies
        const claim = await this.getClaimById(claimId) as unknown as Claim;
        
        if (claim.status !== 'pending') {
            const err = new Error(`Hanya klaim berstatus 'pending' yang dapat ditambahkan proof. Status saat ini: ${claim.status}`) as AppError;
            err.status = 400;
            throw err;
        }

        if (!payload.proof || !payload.public_signals) {
            const err = new Error("Proof and public_signals are required") as AppError;
            err.status = 400;
            throw err;
        }

        // 2. Fetch dependencies for validation
        const { medRecord, patientPolicy, procedure } = await this.getClaimDependencies(
            claim.medical_record_id,
            claim.patient_policy_id,
            claim.procedure_id
        );

        const policyData = patientPolicy.insurance_policies;
        const policy = Array.isArray(policyData) ? policyData[0] : policyData;

        // 3. Save proof and update status via internal helper
        await this.saveProof(
            claim.id,
            {
                proof: payload.proof,
                public_signals: payload.public_signals,
                claim_amount: claim.claim_amount
            },
            claim.procedure_date_encoded,
            policy,
            procedure
        );

        // Fetch updated claim to return to client
        return await this.getClaimById(claim.id);
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
            const err = new Error("Polis belum memiliki approved_diagnosis_root atau approved_procedure_root") as AppError;
            err.status = 400;
            throw err;
        }

        const medDiagnosis = Array.isArray(medRecord.diagnosis) ? medRecord.diagnosis[0] : medRecord.diagnosis;
        if (!medDiagnosis) {
            const err = new Error("Medical record tidak memiliki data diagnosa") as AppError;
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
        const diagLeafData = diagLeaves.map((l: { diagnoses: { icd10_integer_encoding: number } | { icd10_integer_encoding: number }[]; merkle_leaf_index: number; merkle_leaf_hash: string }) => {
            const d = Array.isArray(l.diagnoses) ? l.diagnoses[0] : l.diagnoses;
            return {
                index: l.merkle_leaf_index,
                hash: l.merkle_leaf_hash,
                encoding: d.icd10_integer_encoding
            };
        });

        const procLeafData = procLeaves.map((l: { procedures: { icd9_integer_encoding: number } | { icd9_integer_encoding: number }[]; merkle_leaf_index: number; merkle_leaf_hash: string }) => {
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

        // Generate Signed URLs for ZKP artifacts (wasm & zkey)
        const [wasmUrlRes, zkeyUrlRes] = await Promise.all([
            this.supabase.storage.from('zkp-artifacts').createSignedUrl('insurance_claim.wasm', 3600),
            this.supabase.storage.from('zkp-artifacts').createSignedUrl('insurance_claim.zkey', 3600)
        ]);

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
            maxCoverageAmount: procedure.default_max_coverage,
            artifacts: {
                wasm_url: wasmUrlRes.data?.signedUrl || null,
                zkey_url: zkeyUrlRes.data?.signedUrl || null
            }
        };
    }

    async getClaimById(id: string) {
        const { data: claim, error: claimError } = await this.supabase
            .from('claims')
            .select('*, zkp_proofs(*), procedures:procedure_id(*), patient_policies:patient_policy_id(*, insurance_policies:policy_id(*))')
            .eq('id', id)
            .single();

        if (claimError) {
            const err = new Error(claimError.message) as AppError;
            err.status = 404;
            throw err;
        }

        return claim;
    }

    /**
     * Meminta verifikasi ZKP untuk sebuah klaim secara asinkron (Trigger).
     * Dipanggil oleh Frontend/Dashboard via API Route.
     */
    async verifyClaim(claimId: string) {
        const fullClaim = await this.getClaimById(claimId) as unknown as Claim;
        const zkpProof = fullClaim.zkp_proofs as ZkpProof | undefined;

        if (!zkpProof) {
            const err = new Error("Klaim tidak memiliki ZKP proof untuk diverifikasi") as AppError;
            err.status = 400;
            throw err;
        }

        // Jika sudah pernah diverifikasi, kembalikan hasil cached
        if (zkpProof.verification_result !== null) {
            return {
                claim_id: claimId,
                verification_result: zkpProof.verification_result,
                verified_at: zkpProof.verified_at,
                cached: true
            };
        }

        // Masukkan ke antrean verifikasi asinkron (BullMQ Worker)
        await enqueueVerification(claimId, "manual_review");

        return {
            claim_id: claimId,
            status: "processing",
            message: "Verifikasi klaim telah dimasukkan ke dalam antrean sistem. Mohon tunggu proses real-time selesai."
        };
    }

    /**
     * Eksekutor Logika Verifikasi ZKP (Worker Only).
     * Fungsi ini melakukan pengambilan data relasional dan verifikasi matematis.
     * Tidak memasukkan kembali ke antrean (mencegah infinite loop).
     */
    async executeInternalVerification(claimId: string) {
        const fullClaim = await this.getClaimById(claimId) as unknown as Claim;
        const zkpProof = fullClaim.zkp_proofs as ZkpProof | undefined;

        if (!zkpProof) {
            throw new Error(`[Worker] Claim ${claimId} has no ZKP proof.`);
        }

        // 1. Ambil Dependensi untuk Validasi Sinyal Publik
        const { medRecord, patientPolicy, procedure } = await this.getClaimDependencies(
            fullClaim.medical_record_id,
            fullClaim.patient_policy_id,
            fullClaim.procedure_id
        );

        const policyData = patientPolicy.insurance_policies;
        const policy = Array.isArray(policyData) ? policyData[0] : policyData;

        // 2. Validasi Konsistensi Sinyal Publik
        const validation = validatePublicSignals(zkpProof.public_signals, {
            procedureCode: procedure.icd9_integer_encoding,
            claimAmount: fullClaim.claim_amount,
            procedureDate: fullClaim.procedure_date_encoded,
            approvedDiagnosisRoot: policy.approved_diagnosis_root,
            approvedProcedureRoot: policy.approved_procedure_root,
            maxCoverageAmount: procedure.default_max_coverage
        });

        if (!validation.isValid) {
            console.error(`[Worker] Public signals validation failed for claim ${claimId}: ${validation.reason}`);
            await this.updateVerificationResult(zkpProof.id, false);
            return false;
        }

        // 3. Eksekusi Verifikasi Kriptografi (Matematis)
        const verificationOutput = await verifyProof({
            proof: zkpProof.proof_json,
            publicSignals: zkpProof.public_signals
        });
        const isVerified = verificationOutput.isValid;

        // 4. Update Hasil ke Database
        await this.updateVerificationResult(zkpProof.id, isVerified);
        
        console.log(`[Worker] Claim ${claimId} verification result: ${isVerified}`);
        return isVerified;
    }

    private async updateVerificationResult(proofId: string, result: boolean) {
        const { error } = await this.supabase
            .from('zkp_proofs')
            .update({
                verification_result: result,
                verified_at: new Date().toISOString()
            })
            .eq('id', proofId);

        if (error) {
            throw new Error(`[Worker] Failed to update verification result: ${error.message}`);
        }
    }

    /**
     * Meminta verifikasi ZKP untuk sebuah klaim secara asinkron.
     * Dipanggil oleh insurance_reviewer via route handler.
     * Jika sudah diverifikasi, kembalikan hasil cache.
     * Jika belum, enqueue ke worker dan return status "verifying".
     */
    async requestVerification(claimId: string) {
        return this.verifyClaim(claimId);
    }

    /**
     * Get ZKP proof details for a specific claim.
     * @param claimId Claim UUID
     */
    async getClaimProof(claimId: string) {
        const { data, error } = await this.supabase
            .from('zkp_proofs')
            .select('*')
            .eq('claim_id', claimId)
            .maybeSingle();

        if (error) {
            const err = new Error(error.message) as AppError;
            err.status = 500;
            throw err;
        }

        return data;
    }

    async approveClaim(claimId: string, reviewerId: string, reviewNotes?: string) {
        // Fetch claim with all dependencies in one query, but more defensively
        const { data: claim, error: fetchError } = await this.supabase
            .from('claims')
            .select('*, zkp_proofs (verification_result)')
            .eq('id', claimId)
            .maybeSingle();

        if (fetchError) {
            const err = new Error(`Gagal mengambil data klaim: ${fetchError.message}`) as AppError;
            err.status = 500;
            throw err;
        }

        if (!claim) {
            const err = new Error("Klaim tidak ditemukan atau data kaitan (prosedur/polis) bermasalah.") as AppError;
            err.status = 404;
            throw err;
        }

        // Extract proof from joined table (Supabase returns array for 1-to-many/many-to-many joins)
        const zkpProofsData = (claim as any).zkp_proofs;
        const zkpProof = Array.isArray(zkpProofsData) ? zkpProofsData[0] : zkpProofsData;

        if (!zkpProof) {
            const err = new Error("Klaim tidak dapat disetujui tanpa ZKP proof") as AppError;
            err.status = 400;
            throw err;
        }

        // Cek status verifikasi.
        if (zkpProof.verification_result === null) {
            const err = new Error(
                "Klaim tidak dapat diproses: Verifikasi ZKP belum selesai dilakukan oleh worker. Mohon tunggu beberapa saat."
            ) as AppError;
            err.status = 409;
            throw err;
        }

        if (zkpProof.verification_result === false) {
            const err = new Error("Klaim tidak dapat disetujui: Hasil verifikasi ZKP menyatakan proof TIDAK VALID.") as AppError;
            err.status = 400;
            throw err;
        }

        const { error } = await this.supabase.rpc('approve_claim', {
            p_claim_id: claimId,
            p_reviewer_id: reviewerId,
            p_review_notes: reviewNotes || null
        });

        if (error) {
            const err = new Error(error.message) as AppError;
            err.status = 400;
            throw err;
        }

        return { claim_id: claimId, status: 'approved' };
    }

    private async saveProof(
        claimId: string,
        payload: { proof: unknown; public_signals: string[]; claim_amount: number },
        procedureDateEncoded: number,
        policy: InsurancePolicy,
        procedure: Procedure
    ) {
        try {
            // 4.1 Validasi Konsistensi Data dengan Public Signals ZKP
            const validation = validatePublicSignals(payload.public_signals, {
                procedureCode: procedure.icd9_integer_encoding,
                claimAmount: payload.claim_amount,
                procedureDate: procedureDateEncoded,
                approvedDiagnosisRoot: policy.approved_diagnosis_root,
                approvedProcedureRoot: policy.approved_procedure_root,
                maxCoverageAmount: procedure.default_max_coverage
            });

            if (!validation.isValid) {
                const err = new Error(`Integritas data ZKP gagal: ${validation.reason}`) as AppError;
                err.status = 400;
                throw err;
            }

            const { error: proofError } = await this.supabase
                .from('zkp_proofs')
                .insert({
                    claim_id: claimId,
                    proof_json: payload.proof,
                    public_signals: payload.public_signals
                });

            if (proofError) {
                throw new Error(`Gagal menyimpan proof: ${proofError.message}`);
            }

            // 5. Update status claim jadi submitted
            await this.supabase.from('claims').update({ status: 'submitted' }).eq('id', claimId);

            // 6. Enqueue verifikasi asinkron dihapus, sekarang dilakukan manual via tombol 'Verify' di Dashboard
        } catch (err) {
            await this.supabase.from('claims').update({ status: 'Fail generate proof' }).eq('id', claimId);
            throw err;
        }
    }

    async rejectClaim(claimId: string, reviewerId: string, reviewNotes: string) {
        if (!reviewNotes || reviewNotes.trim() === '') {
            const err = new Error("review_notes wajib diisi saat menolak klaim") as AppError;
            err.status = 400;
            throw err;
        }

        // Fetch claim and zkp status for rejection guard
        const { data: claim, error: fetchError } = await this.supabase
            .from('claims')
            .select('zkp_proofs(verification_result)')
            .eq('id', claimId)
            .maybeSingle();

        if (fetchError || !claim) {
            const err = new Error("Klaim tidak ditemukan.") as AppError;
            err.status = 404;
            throw err;
        }

        const zkpProofsData = (claim as any).zkp_proofs;
        const zkpProof = Array.isArray(zkpProofsData) ? zkpProofsData[0] : zkpProofsData;

        if (!zkpProof || zkpProof.verification_result === null) {
            const err = new Error(
                "Klaim tidak dapat diproses: Verifikasi ZKP belum selesai dilakukan. Keputusan manual (Reject) hanya dapat diambil setelah integritas proof diverifikasi sistem."
            ) as AppError;
            err.status = 409;
            throw err;
        }

        const { error } = await this.supabase.rpc('reject_claim', {
            p_claim_id: claimId,
            p_reviewer_id: reviewerId,
            p_review_notes: reviewNotes
        });

        if (error) {
            const err = new Error(error.message) as AppError;
            err.status = 400;
            throw err;
        }
        return { claim_id: claimId, status: 'rejected' };
    }

    private async getClaimDependencies(medical_record_id: string, patient_policy_id: string, procedure_id: string) {
        const [mrRes, ppRes, procRes] = await Promise.all([
            this.supabase.from('medical_records')
                .select('*, diagnosis:diagnosis_id(icd10_integer_encoding)')
                .eq('id', medical_record_id).single(),
            this.supabase.from('patient_policies')
                .select('*, insurance_policies:policy_id(*)')
                .eq('id', patient_policy_id).single(),
            this.supabase.from('procedures')
                .select('*')
                .eq('id', procedure_id).single()
        ]);

        if (mrRes.error) { const err = new Error(`Gagal ambil medical record: ${mrRes.error.message}`) as AppError; err.status = 404; throw err; }
        if (ppRes.error) { const err = new Error(`Gagal ambil patient policy: ${ppRes.error.message}`) as AppError; err.status = 404; throw err; }
        if (procRes.error) { const err = new Error(`Gagal ambil procedure: ${procRes.error.message}`) as AppError; err.status = 404; throw err; }

        return {
            medRecord: mrRes.data as MedicalRecord,
            patientPolicy: ppRes.data,
            procedure: procRes.data
        };
    }
}
