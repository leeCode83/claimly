import { ClaimService } from './claim.service';
import { generateProof, verifyProof, getMerklePath } from '@/service/zkp';

jest.mock('@/service/zkp', () => ({
    generateProof: jest.fn(),
    verifyProof: jest.fn(),
    getMerklePath: jest.fn(),
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
        };

        claimService = new ClaimService(supabaseMock as any);
    });

    const mockPayload = {
        patient_policy_id: 'policy-123',
        medical_record_id: 'mr-123',
        procedure_id: 'proc-123',
        procedure_date: '2026-03-20',
        claim_amount: 500000,
        proof: { pi_a: ['1'] },
        public_signals: ['123']
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

    describe('submitClaim', () => {

        it('harus error jika ada parameter yang kosong', async () => {
            await expect(claimService.submitClaim({} as any, submitterId)).rejects.toThrow('Semua field wajib diisi');
        });

        it('harus error jika medical_records tidak ditemukan (invalid ID)', async () => {
            // Mock single() me-return error pada query DB pertama
            supabaseMock.from().single
                .mockResolvedValueOnce({ data: null, error: { message: 'Not found MR' } })
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: {}, error: null });

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Gagal ambil medical record: Not found MR');
        });


        it('harus melempar error temporal jika procedure_date < diagnosis_date', async () => {
            const { medRecord, patientPolicy, procedure } = setupHappyMocks();
            // encoded date 2026-03-20 -> 20260320. 
            // Set diagnosis after procedure (fail validation)
            medRecord.diagnosis_date_encoded = 20260325;

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.');
        });

        it('harus melempar error limit jika claim_amount melebihi max_coverage', async () => {
            const { procedure } = setupHappyMocks();
            procedure.default_max_coverage = 100000; // Limit 100rb, claim 500rb

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal');
        });

        it('harus melempar error jika verifikasi proof gagal', async () => {
            setupHappyMocks();
            (verifyProof as jest.Mock).mockResolvedValueOnce({ isValid: false });

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Verifikasi ZKP Proof gagal: Bukti tidak valid atau tidak sesuai dengan data klaim.');
        });

        it('berhasil melakukan submisi claim dengan proof dari client', async () => {
            setupHappyMocks();

            const result = await claimService.submitClaim(mockPayload, submitterId);
            
            expect(result).toBeDefined();
            expect(result.id).toBe('claim-123');
            expect(verifyProof).toHaveBeenCalled();
            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
        });
    });

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

            // Mock getClaimDependencies
            (claimService as any).getClaimDependencies = jest.fn().mockResolvedValue({
                medRecord,
                patientPolicy,
                procedure
            });

            // Mock search leaves for Merkle tree
            supabaseMock.from.mockImplementation((table: string) => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
            }));

            // Mock getMerklePath
            (getMerklePath as jest.Mock).mockResolvedValue({ pathElements: ['0x1'], pathIndices: [0] });

            const result = await claimService.getZKPPreparationData(mockPayload);
            
            expect(result).toBeDefined();
            expect(result.diagnosisCode).toBe(123);
            expect(result.approvedDiagnosisRoot).toBe('rootA');
            expect(getMerklePath).toHaveBeenCalledTimes(2);
        });
        it('harus melempar error jika polis tidak memiliki Merkle roots', async () => {
            const { medRecord, patientPolicy, procedure } = setupHappyMocks();
            // In setupHappyMocks, patientPolicy is returned as a single object from the mock, 
            // but the mock implementation for getClaimDependencies returns it as patientPolicy.
            // Let's adjust insurance_policies directly.
            patientPolicy.insurance_policies.approved_diagnosis_root = null;

            await expect(claimService.getZKPPreparationData(mockPayload)).rejects.toThrow('Polis belum memiliki approved_diagnosis_root atau approved_procedure_root');
        });

        it('harus melempar error jika medical record tidak memiliki diagnosa', async () => {
            const { medRecord, patientPolicy, procedure } = setupHappyMocks();
            medRecord.diagnosis = null;

            await expect(claimService.getZKPPreparationData(mockPayload)).rejects.toThrow('Medical record tidak memiliki data diagnosa');
        });
    });

    describe('getClaimById', () => {
        it('berhasil mengambil data claim dan melakukan auto-verify proof jika belum diverifikasi', async () => {
            const mockClaim = {
                id: 'claim-123',
                status: 'submitted',
                zkp_proofs: {
                    id: 'proof-456',
                    proof_json: {},
                    public_signals: [],
                    verification_result: null
                }
            };

            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null }),
                update: jest.fn().mockReturnThis()
            }));

            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const result = await claimService.getClaimById('claim-123');

            expect(result).toBeDefined();
            expect(verifyProof).toHaveBeenCalled();
            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
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

    describe('approveClaim', () => {
        const reviewerId = 'rev-1';

        it('berhasil menyetujui klaim setelah verifikasi ZKP', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: {
                    id: 'proof-456',
                    proof_json: {},
                    public_signals: [],
                    verification_result: null
                }
            };

            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null }),
                update: jest.fn().mockReturnThis()
            }));

            supabaseMock.rpc.mockResolvedValue({ error: null });
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const result = await claimService.approveClaim('claim-123', reviewerId);

            expect(result.status).toBe('approved');
            expect(supabaseMock.rpc).toHaveBeenCalledWith('approve_claim', expect.any(Object));
        });

        it('harus melempar error jika klaim tidak ditemukan', async () => {
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            }));

            await expect(claimService.approveClaim('invalid-id', reviewerId)).rejects.toThrow('Klaim tidak ditemukan');
        });

        it('harus melempar error jika ZKP proof tidak valid', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: {
                    id: 'proof-456',
                    proof_json: {},
                    public_signals: [],
                    verification_result: null
                }
            };

            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockClaim, error: null }),
                update: jest.fn().mockReturnThis()
            }));

            (verifyProof as jest.Mock).mockResolvedValue({ isValid: false });

            await expect(claimService.approveClaim('claim-123', reviewerId)).rejects.toThrow('Klaim tidak dapat disetujui: ZKP proof tidak valid');
        });
    });

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
