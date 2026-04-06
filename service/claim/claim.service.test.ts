import { ClaimService } from './claim.service';
import { verifyProof, getMerklePath } from '@/service/zkp';

jest.mock('@/service/zkp', () => ({
    generateProof: jest.fn(),
    verifyProof: jest.fn(),
    validatePublicSignals: jest.fn().mockReturnValue({ isValid: true }),
    getMerklePath: jest.fn(),
}));

jest.mock('@/lib/queue-helpers', () => ({
    enqueueVerification: jest.fn().mockResolvedValue(undefined),
}));

describe('ClaimService', () => {
    let supabaseMock: any;
    let claimService: ClaimService;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup dasar mock builder untuk Supabase
        const mockBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            single: jest.fn(),
        };

        supabaseMock = {
            from: jest.fn(() => mockBuilder),
            rpc: jest.fn(),
            storage: {
                from: jest.fn().mockReturnValue({
                    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'http://signed-url' }, error: null })
                })
            }
        };

        // Default mock for validatePublicSignals
        const { validatePublicSignals } = require('@/service/zkp');
        (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: true });

        claimService = new ClaimService(supabaseMock as any);
    });

    const mockPayload = {
        patient_policy_id: 'policy-123',
        medical_record_id: 'mr-123',
        procedure_id: 'proc-123',
        procedure_date: '2026-03-20',
        claim_amount: 500000,
        proof: { pi_a: ['1'] },
        public_signals: ['123', '20260320', '500000', 'rootA', 'rootB', '1000000']
    };
    const submitterId = 'user-123';

    const setupHappyMocks = () => {
        const medRecord: any = { 
            diagnosis_date_encoded: 20260315, 
            diagnosis: { icd10_integer_encoding: 123 } 
        };
        const patientPolicy: any = {
            start_date: '2026-01-01',
            end_date: '2026-12-31',
            insurance_policies: { 
                id: 'ins-123', 
                approved_diagnosis_root: 'rootA', 
                approved_procedure_root: 'rootB' 
            }
        };
        const procedure = { 
            default_max_coverage: 1000000, 
            icd9_integer_encoding: 456 
        };

        // Mock signal validation
        const { validatePublicSignals } = require('@/service/zkp');
        (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: true });

        // Mock verifyProof to return true
        (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

        // Mock internal call getClaimDependencies
        (claimService as any).getClaimDependencies = jest.fn().mockResolvedValue({
            medRecord,
            patientPolicy,
            procedure
        });

        // Mock supabase interactions for insertion
        const mockInsertBuilder = {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'claim-123' }, error: null })
        };
        supabaseMock.from.mockImplementation((table: string) => {
            if (table === 'claims') {
                return {
                    insert: jest.fn().mockReturnValue(mockInsertBuilder),
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({ error: null })
                };
            }
            if (table === 'zkp_proofs') {
                return { insert: jest.fn().mockResolvedValue({ error: null }) };
            }
            return { 
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: {}, error: null }) 
            };
        });
        
        return { medRecord, patientPolicy, procedure };
    };

    // ─────────────────────────────────────────────
    // submitClaim
    // ─────────────────────────────────────────────
    describe('submitClaim', () => {

        it('harus error jika ada parameter yang kosong', async () => {
            await expect(claimService.submitClaim({} as any, submitterId)).rejects.toThrow('Semua field wajib diisi');
        });

        it('harus error jika medical_records tidak ditemukan (invalid ID)', async () => {
            supabaseMock.from().single
                .mockResolvedValueOnce({ data: null, error: { message: 'Not found MR' } })
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: {}, error: null });

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Gagal ambil medical record: Not found MR');
        });

        it('harus melempar error temporal jika procedure_date < diagnosis_date', async () => {
            const { medRecord } = setupHappyMocks();
            medRecord.diagnosis_date_encoded = 20260325; // diagnosis setelah prosedur
            
            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.');
        });

        it('harus melempar error limit jika claim_amount melebihi max_coverage', async () => {
            const { procedure } = setupHappyMocks();
            procedure.default_max_coverage = 100000; // Limit 100rb, claim 500rb

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal');
        });

        it('berhasil melakukan submisi claim dengan proof dari client', async () => {
            setupHappyMocks();

            const result = await claimService.submitClaim(mockPayload, submitterId);
            
            expect(result).toBeDefined();
            expect(result.id).toBe('claim-123');
            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
            
            // Verifikasi Helper called
            const { enqueueVerification } = require('@/lib/queue-helpers');
            expect(enqueueVerification).toHaveBeenCalledWith('claim-123', 'submit');
        });
    });

    // ─────────────────────────────────────────────
    // submitClaimProof
    // ─────────────────────────────────────────────
    describe('submitClaimProof', () => {
        it('harus berhasil submit proof untuk klaim berstatus pending', async () => {
            setupHappyMocks();
            const mockClaim = { 
                id: 'claim-123', 
                status: 'pending', 
                claim_amount: 500000,
                medical_record_id: 'mr-123',
                patient_policy_id: 'policy-123',
                procedure_id: 'proc-123',
                procedure_date_encoded: 20260320
            };
            
            // Mock getClaimById via member function override for simplicity in test
            claimService.getClaimById = jest.fn().mockResolvedValue(mockClaim);
            
            // Mock internal saveProof
            (claimService as any).saveProof = jest.fn().mockResolvedValue(undefined);

            const result = await claimService.submitClaimProof('claim-123', {
                proof: mockPayload.proof,
                public_signals: mockPayload.public_signals
            });

            expect(result.message).toContain('berhasil disubmit');
            expect((claimService as any).saveProof).toHaveBeenCalled();
        });

        it('harus error jika klaim tidak berstatus pending (misal: submitted)', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue({ id: '123', status: 'submitted' });

            await expect(claimService.submitClaimProof('123', {
                proof: {},
                public_signals: []
            })).rejects.toThrow("Hanya klaim berstatus 'pending' yang dapat ditambahkan proof");
        });

        it('harus error jika payload proof/signals kosong', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue({ id: '123', status: 'pending' });

            await expect(claimService.submitClaimProof('123', {} as any))
                .rejects.toThrow("Proof and public_signals are required");
        });
    });

    // ─────────────────────────────────────────────
    // saveProof (private method, diakses via cast)
    // ─────────────────────────────────────────────
    describe('saveProof', () => {
        const mockPolicy = {
            id: 'ins-123',
            approved_diagnosis_root: 'rootA',
            approved_procedure_root: 'rootB'
        };
        const mockProcedure = {
            id: 'proc-123',
            icd9_integer_encoding: 456,
            default_max_coverage: 1000000
        };
        const mockProofPayload = {
            proof: { pi_a: ['1'] },
            public_signals: ['456', '20260320', '500000', 'rootA', 'rootB', '1000000'],
            claim_amount: 500000
        };

        it('berhasil menyimpan proof dan update status claim ke submitted', async () => {
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            supabaseMock.from.mockImplementation((table: string) => {
                if (table === 'zkp_proofs') {
                    return { insert: jest.fn().mockResolvedValue({ error: null }) };
                }
                if (table === 'claims') {
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({ error: null })
                    };
                }
                return {};
            });

            await expect(
                (claimService as any).saveProof('claim-123', mockProofPayload, 20260320, mockPolicy, mockProcedure)
            ).resolves.not.toThrow();

            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
        });

        it('harus melempar error jika validatePublicSignals gagal', async () => {
            const { validatePublicSignals } = require('@/service/zkp');
            (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: false, reason: 'Data tidak cocok' });

            await expect(
                (claimService as any).saveProof('claim-123', mockProofPayload, 20260320, mockPolicy, mockProcedure)
            ).rejects.toThrow('Integritas data ZKP gagal: Data tidak cocok');
        });

        it('harus update status claim ke "Fail generate proof" jika insert zkp_proofs gagal', async () => {
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const mockUpdateBuilder = { eq: jest.fn().mockResolvedValue({ error: null }) };
            supabaseMock.from.mockImplementation((table: string) => {
                if (table === 'zkp_proofs') {
                    return { insert: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }) };
                }
                if (table === 'claims') {
                    return {
                        update: jest.fn().mockReturnValue(mockUpdateBuilder)
                    };
                }
                return {};
            });

            await expect(
                (claimService as any).saveProof('claim-123', mockProofPayload, 20260320, mockPolicy, mockProcedure)
            ).rejects.toThrow('Gagal menyimpan proof: DB error');

            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
        });
    });

    // ─────────────────────────────────────────────
    // getZKPPreparationData
    // ─────────────────────────────────────────────
    describe('getZKPPreparationData', () => {
        const mockPayload = {
            medical_record_id: 'mr-123',
            patient_policy_id: 'policy-123',
            procedure_id: 'proc-123',
            procedure_date: '2026-03-20',
            claim_amount: 500000,
        };

        it('berhasil mengambil data persiapan ZKP', async () => {
            const medRecord = { 
                diagnosis_date_encoded: 20260315, 
                diagnosis: { icd10_integer_encoding: 123 } 
            };
            const patientPolicy = {
                start_date: '2026-01-01',
                end_date: '2026-12-31',
                insurance_policies: { 
                    approved_diagnosis_root: 'rootA', 
                    approved_procedure_root: 'rootB' 
                }
            };
            const procedure = { 
                default_max_coverage: 1000000, 
                icd9_integer_encoding: 456 
            };

            (claimService as any).getClaimDependencies = jest.fn().mockResolvedValue({
                medRecord,
                patientPolicy,
                procedure
            });

            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
            }));

            (getMerklePath as jest.Mock).mockResolvedValue({ pathElements: ['0x1'], pathIndices: [0] });

            const result = await claimService.getZKPPreparationData(mockPayload);
            
            expect(result).toBeDefined();
            expect(result.diagnosisCode).toBe(123);
            expect(result.approvedDiagnosisRoot).toBe('rootA');
            expect(getMerklePath).toHaveBeenCalledTimes(2);
        });

        it('harus melempar error jika polis tidak memiliki Merkle roots', async () => {
            const { medRecord, patientPolicy } = setupHappyMocks();
            patientPolicy.insurance_policies.approved_diagnosis_root = null;

            await expect(claimService.getZKPPreparationData(mockPayload)).rejects.toThrow('Polis belum memiliki approved_diagnosis_root atau approved_procedure_root');
        });

        it('harus melempar error jika medical record tidak memiliki diagnosa', async () => {
            const { medRecord } = setupHappyMocks();
            medRecord.diagnosis = null;

            await expect(claimService.getZKPPreparationData(mockPayload)).rejects.toThrow('Medical record tidak memiliki data diagnosa');
        });
    });

    // ─────────────────────────────────────────────
    // getClaimById
    // ─────────────────────────────────────────────
    describe('getClaimById', () => {
        it('berhasil mengambil data claim tanpa melakukan verifikasi proof', async () => {
            const mockClaim = {
                id: 'claim-123',
                status: 'submitted',
                zkp_proofs: {
                    id: 'proof-456',
                    proof_json: {},
                    public_signals: ['1'],
                    verification_result: null
                }
            };

            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null })
            }));

            const result = await claimService.getClaimById('claim-123');

            expect(result).toBeDefined();
            expect(result.id).toBe('claim-123');
            // Verifikasi TIDAK dipanggil — getClaimById hanya fetch data
            expect(verifyProof).not.toHaveBeenCalled();
        });

        it('harus melempar error jika claim tidak ditemukan', async () => {
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            }));

            await expect(claimService.getClaimById('invalid-id')).rejects.toThrow('Not found');
        });
    });

    // ─────────────────────────────────────────────
    // verifyClaim
    // ─────────────────────────────────────────────
    describe('verifyClaim', () => {
        const mockFullClaim = {
            id: 'claim-123',
            claim_amount: 500000,
            procedure_date_encoded: 20260320,
            status: 'submitted',
            zkp_proofs: {
                id: 'proof-456',
                proof_json: {},
                public_signals: ['1', '20260320', '500000', 'rootA', 'rootB', '1000000'],
                verification_result: null,
                verified_at: null
            },
            procedures: { id: 'proc-123', icd9_integer_encoding: 456, default_max_coverage: 1000000 },
            patient_policies: {
                insurance_policies: {
                    id: 'ins-123',
                    approved_diagnosis_root: 'rootA',
                    approved_procedure_root: 'rootB'
                }
            }
        };

        it('berhasil memverifikasi proof dan menyimpan hasilnya di zkp_proofs', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const mockUpdateBuilder = { eq: jest.fn().mockResolvedValue({ error: null }) };
            supabaseMock.from.mockImplementation(() => ({
                update: jest.fn().mockReturnValue(mockUpdateBuilder)
            }));

            const result = await claimService.verifyClaim('claim-123');

            expect(result.verification_result).toBe(true);
            expect(result.cached).toBe(false);
            expect(verifyProof).toHaveBeenCalled();
            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
        });

        it('mengembalikan hasil cached jika proof sudah pernah diverifikasi', async () => {
            const cachedClaim = {
                ...mockFullClaim,
                zkp_proofs: {
                    ...mockFullClaim.zkp_proofs,
                    verification_result: true,
                    verified_at: '2026-04-01T00:00:00.000Z'
                }
            };

            claimService.getClaimById = jest.fn().mockResolvedValue(cachedClaim);

            const result = await claimService.verifyClaim('claim-123');

            expect(result.verification_result).toBe(true);
            expect(result.cached).toBe(true);
            // Tidak perlu verifikasi ulang
            expect(verifyProof).not.toHaveBeenCalled();
        });

        it('harus melempar error jika klaim tidak memiliki ZKP proof', async () => {
            const claimWithoutProof = { ...mockFullClaim, zkp_proofs: null };
            claimService.getClaimById = jest.fn().mockResolvedValue(claimWithoutProof);

            await expect(claimService.verifyClaim('claim-123')).rejects.toThrow('Klaim tidak memiliki ZKP proof untuk diverifikasi');
        });

        it('harus melempar error jika validatePublicSignals gagal (integritas data)', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);

            const { validatePublicSignals } = require('@/service/zkp');
            (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: false, reason: 'Amount berbeda' });

            await expect(claimService.verifyClaim('claim-123')).rejects.toThrow('Integritas proof gagal: Amount berbeda');
        });

        it('harus melempar error jika verifyProof return false (proof tidak valid)', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: false });

            await expect(claimService.verifyClaim('claim-123')).rejects.toThrow('Verifikasi ZKP proof gagal: bukti tidak valid atau tidak sesuai dengan data klaim');
        });

        it('harus melempar error jika update zkp_proofs gagal', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const mockUpdateBuilder = { eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } }) };
            supabaseMock.from.mockImplementation(() => ({
                update: jest.fn().mockReturnValue(mockUpdateBuilder)
            }));

            await expect(claimService.verifyClaim('claim-123')).rejects.toThrow('Gagal menyimpan hasil verifikasi: Update failed');
        });
    });

    // ─────────────────────────────────────────────
    // requestVerification
    // ─────────────────────────────────────────────
    describe('requestVerification', () => {
        it('harus enqueue job dan return status "verifying" jika belum diverifikasi', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: null }
            };
            claimService.getClaimById = jest.fn().mockResolvedValue(mockClaim);

            const result = await claimService.requestVerification('claim-123');
            
            expect(result.status).toBe('verifying');
            const { enqueueVerification } = require('@/lib/queue-helpers');
            expect(enqueueVerification).toHaveBeenCalledWith('claim-123', 'manual_review');
        });

        it('harus kembalikan hasil cached jika sudah diverifikasi', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: true, verified_at: '2026-04-01' }
            };
            claimService.getClaimById = jest.fn().mockResolvedValue(mockClaim);

            const result = await claimService.requestVerification('claim-123');
            
            expect(result.status).toBe('already_verified');
            expect(result.verification_result).toBe(true);
            const { enqueueVerification } = require('@/lib/queue-helpers');
            expect(enqueueVerification).not.toHaveBeenCalledWith('claim-123', 'manual_review');
        });

        it('harus error jika klaim tidak memiliki proof', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue({ id: '123', zkp_proofs: null });
            await expect(claimService.requestVerification('123')).rejects.toThrow('Klaim tidak memiliki ZKP proof untuk diverifikasi');
        });
    });

    // ─────────────────────────────────────────────
    // approveClaim
    // ─────────────────────────────────────────────
    describe('approveClaim', () => {
        const reviewerId = 'rev-1';

        it('berhasil menyetujui klaim jika sudah diverifikasi', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: true }
            };
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null })
            }));

            supabaseMock.rpc.mockResolvedValue({ error: null });

            const result = await claimService.approveClaim('claim-123', reviewerId);

            expect(result.status).toBe('approved');
            expect(supabaseMock.rpc).toHaveBeenCalledWith('approve_claim', expect.any(Object));
        });

        it('harus throw 409 jika proof belum diverifikasi (verification_result: null)', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: null }
            };
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null })
            }));
            
            const { enqueueVerification } = require('@/lib/queue-helpers');

            await expect(claimService.approveClaim('claim-123', reviewerId))
                .rejects.toMatchObject({ 
                    message: expect.stringContaining('sedang diproses'),
                    status: 409 
                });
            
            expect(enqueueVerification).toHaveBeenCalledWith('claim-123', 'manual_review');
        });

        it('harus melempar error jika klaim tidak ditemukan', async () => {
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            }));

            await expect(claimService.approveClaim('invalid-id', reviewerId)).rejects.toThrow('Klaim tidak ditemukan');
        });

        it('harus melempar error jika ZKP proof tidak valid (false)', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: false }
            };
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null })
            }));

            await expect(claimService.approveClaim('claim-123', reviewerId)).rejects.toThrow('ZKP proof tidak valid');
        });
    });

    // ─────────────────────────────────────────────
    // rejectClaim
    // ─────────────────────────────────────────────
    describe('rejectClaim', () => {
        it('berhasil menolak klaim dengan catatan', async () => {
            supabaseMock.rpc.mockResolvedValue({ error: null });

            const result = await claimService.rejectClaim('claim-123', 'rev-1', 'Diagnosis tidak sesuai');

            expect(result.status).toBe('rejected');
            expect(supabaseMock.rpc).toHaveBeenCalledWith('reject_claim', expect.any(Object));
        });

        it('harus melempar error jika catatan penolakan kosong', async () => {
            await expect(claimService.rejectClaim('claim-123', 'rev-1', '')).rejects.toThrow('review_notes wajib diisi');
        });
    });
});
