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
    // getClaims
    // ─────────────────────────────────────────────
    describe('getClaims', () => {
        it('berhasil mengambil daftar klaim dengan paginasi', async () => {
            const mockData = [
                { id: '1', total_count: 2 },
                { id: '2', total_count: 2 }
            ];
            supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

            const result = await claimService.getClaims({ page: 1, limit: 10 });

            expect(result.data).toEqual(mockData);
            expect(result.meta.total).toBe(2);
            expect(result.meta.total_pages).toBe(1);
            expect(supabaseMock.rpc).toHaveBeenCalledWith('get_claims_paginated', expect.objectContaining({
                p_page: 1,
                p_limit: 10
            }));
        });

        it('harus melempar error jika RPC gagal', async () => {
            supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });

            await expect(claimService.getClaims({})).rejects.toThrow('Database error');
        });
    });

    // ─────────────────────────────────────────────
    // submitClaim
    // ─────────────────────────────────────────────
    describe('submitClaim', () => {

        it('harus error jika ada parameter yang kosong', async () => {
            await expect(claimService.submitClaim({} as any, submitterId)).rejects.toThrow('Semua field wajib diisi');
        });

        it('harus error jika medical_records tidak ditemukan (invalid ID)', async () => {
            // Mock internal call getClaimDependencies to fail
            (claimService as any).getClaimDependencies = jest.fn().mockRejectedValue(new Error('Gagal ambil medical record: Not found MR'));

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Gagal ambil medical record: Not found MR');
        });

        it('harus melempar error temporal jika procedure_date < diagnosis_date', async () => {
            const { medRecord } = setupHappyMocks();
            medRecord.diagnosis_date_encoded = 20260325; // diagnosis setelah prosedur
            
            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.');
        });

        it('harus melempar error jika procedure_date di luar masa aktif polis', async () => {
            const { patientPolicy } = setupHappyMocks();
            patientPolicy.start_date = '2026-04-01'; // Polis mulai April, klaim Maret
            
            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Tanggal prosedur di luar masa aktif polis asuransi.');
        });

        it('harus melempar error limit jika claim_amount melebihi max_coverage', async () => {
            const { procedure } = setupHappyMocks();
            procedure.default_max_coverage = 100000; // Limit 100rb, claim 500rb

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal');
        });

        it('berhasil melakukan submisi claim dengan proof dari client', async () => {
            setupHappyMocks();
            // Mock internal saveProof to avoid DB calls in this method test
            (claimService as any).saveProof = jest.fn().mockResolvedValue(undefined);

            const result = await claimService.submitClaim(mockPayload, submitterId);
            
            expect(result).toBeDefined();
            expect(result.id).toBe('claim-123');
            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
            expect((claimService as any).saveProof).toHaveBeenCalled();
        });

        it('berhasil melakukan submisi claim tanpa proof (status pending)', async () => {
            setupHappyMocks();
            const payloadWithoutProof = { ...mockPayload, proof: undefined, public_signals: undefined };
            
            const result = await claimService.submitClaim(payloadWithoutProof, submitterId);
            
            expect(result.id).toBe('claim-123');
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
    // ─────────────────────────────────────────────
    // verifyClaim
    // ─────────────────────────────────────────────
    describe('verifyClaim', () => {
        const mockFullClaim = {
            id: 'claim-123',
            zkp_proofs: {
                id: 'proof-456',
                verification_result: null,
            }
        };

        it('berhasil memasukkan klaim ke antrean verifikasi (processing)', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);
            const { enqueueVerification } = require('@/lib/queue-helpers');

            const result = await claimService.verifyClaim('claim-123');

            expect(result.status).toBe('processing');
            expect(enqueueVerification).toHaveBeenCalledWith('claim-123', 'manual_review');
        });

        it('mengembalikan hasil cached jika sudah pernah diverifikasi', async () => {
            const cachedClaim = {
                ...mockFullClaim,
                zkp_proofs: {
                    id: 'proof-456',
                    verification_result: true,
                    verified_at: '2026-04-01T00:00:00.000Z'
                }
            };
            claimService.getClaimById = jest.fn().mockResolvedValue(cachedClaim);

            const result = await claimService.verifyClaim('claim-123');

            expect(result.cached).toBe(true);
            expect(result.verification_result).toBe(true);
        });

        it('harus error jika klaim tidak memiliki ZKP proof', async () => {
            claimService.getClaimById = jest.fn().mockResolvedValue({ ...mockFullClaim, zkp_proofs: null });
            await expect(claimService.verifyClaim('claim-123')).rejects.toThrow('Klaim tidak memiliki ZKP proof untuk diverifikasi');
        });
    });

    // ─────────────────────────────────────────────
    // executeInternalVerification (Worker Logic)
    // ─────────────────────────────────────────────
    describe('executeInternalVerification', () => {
        const mockFullClaim = {
            id: 'claim-123',
            medical_record_id: 'mr-1',
            patient_policy_id: 'pp-1',
            procedure_id: 'proc-1',
            claim_amount: 500000,
            procedure_date_encoded: 20260320,
            zkp_proofs: {
                id: 'proof-456',
                proof_json: {},
                public_signals: ['1', '2']
            }
        };

        beforeEach(() => {
            claimService.getClaimById = jest.fn().mockResolvedValue(mockFullClaim);
            (claimService as any).getClaimDependencies = jest.fn().mockResolvedValue({
                medRecord: {},
                patientPolicy: { insurance_policies: { approved_diagnosis_root: 'root', approved_procedure_root: 'root' } },
                procedure: { icd9_integer_encoding: 123, default_max_coverage: 1000000 }
            });
            (claimService as any).updateVerificationResult = jest.fn().mockResolvedValue(undefined);
        });

        it('berhasil memverifikasi proof secara internal (Worker)', async () => {
            const { validatePublicSignals, verifyProof } = require('@/service/zkp');
            (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: true });
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: true });

            const result = await claimService.executeInternalVerification('claim-123');

            expect(result).toBe(true);
            expect((claimService as any).updateVerificationResult).toHaveBeenCalledWith('proof-456', true);
        });

        it('gagal jika validasi public signals tidak valid', async () => {
            const { validatePublicSignals } = require('@/service/zkp');
            (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: false, reason: 'Mismatch' });

            const result = await claimService.executeInternalVerification('claim-123');

            expect(result).toBe(false);
            expect((claimService as any).updateVerificationResult).toHaveBeenCalledWith('proof-456', false);
        });

        it('gagal jika verifyProof matematis return false', async () => {
            const { validatePublicSignals, verifyProof } = require('@/service/zkp');
            (validatePublicSignals as jest.Mock).mockReturnValue({ isValid: true });
            (verifyProof as jest.Mock).mockResolvedValue({ isValid: false });

            const result = await claimService.executeInternalVerification('claim-123');

            expect(result).toBe(false);
            expect((claimService as any).updateVerificationResult).toHaveBeenCalledWith('proof-456', false);
        });
    });

    // ─────────────────────────────────────────────
    // requestVerification
    // ─────────────────────────────────────────────
    // ─────────────────────────────────────────────
    // requestVerification
    // ─────────────────────────────────────────────
    describe('requestVerification', () => {
        it('harus memanggil verifyClaim', async () => {
            claimService.verifyClaim = jest.fn().mockResolvedValue({ status: 'processing' });
            const result = await claimService.requestVerification('123');
            expect(result.status).toBe('processing');
            expect(claimService.verifyClaim).toHaveBeenCalledWith('123');
        });
    });

    // ─────────────────────────────────────────────
    // getClaimProof
    // ─────────────────────────────────────────────
    describe('getClaimProof', () => {
        it('berhasil mengambil data proof', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'proof-1' }, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));

            const result = await claimService.getClaimProof('claim-123');
            expect(result.id).toBe('proof-1');
        });

        it('harus throw jika query error', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'Fetch error' } });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            await expect(claimService.getClaimProof('123')).rejects.toThrow('Fetch error');
        });
    });

    // ─────────────────────────────────────────────
    // approveClaim
    // ─────────────────────────────────────────────
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
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockClaim, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            supabaseMock.rpc.mockResolvedValue({ error: null });

            const result = await claimService.approveClaim('claim-123', reviewerId);

            expect(result.status).toBe('approved');
            expect(supabaseMock.rpc).toHaveBeenCalledWith('approve_claim', expect.any(Object));
        });

        it('harus error 400 jika klaim tidak memiliki ZKP proof', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: '123', zkp_proofs: null }, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            await expect(claimService.approveClaim('123', reviewerId)).rejects.toMatchObject({ status: 400 });
        });

        it('harus throw 409 jika proof belum diverifikasi (verification_result: null)', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: null }
            };
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockClaim, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));

            await expect(claimService.approveClaim('claim-123', reviewerId))
                .rejects.toMatchObject({ 
                    status: 409 
                });
        });

        it('harus melempar error jika ZKP proof tidak valid (false)', async () => {
            const mockClaim = {
                id: 'claim-123',
                zkp_proofs: { verification_result: false }
            };
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockClaim, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));

            await expect(claimService.approveClaim('claim-123', reviewerId)).rejects.toMatchObject({ status: 400 });
        });

        it('harus melempar error jika RPC approve_claim gagal', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { zkp_proofs: { verification_result: true } }, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            supabaseMock.rpc.mockResolvedValue({ error: { message: 'RPC error' } });

            await expect(claimService.approveClaim('123', reviewerId)).rejects.toThrow('RPC error');
        });
    });

    // ─────────────────────────────────────────────
    // rejectClaim
    // ─────────────────────────────────────────────
    describe('rejectClaim', () => {
        const reviewerId = 'rev-1';
        const notes = 'Rejection notes';

        it('berhasil menolak klaim dengan catatan', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ 
                data: { zkp_proofs: { verification_result: false } }, 
                error: null 
            });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            supabaseMock.rpc.mockResolvedValue({ error: null });

            const result = await claimService.rejectClaim('claim-123', reviewerId, notes);

            expect(result.status).toBe('rejected');
            expect(supabaseMock.rpc).toHaveBeenCalledWith('reject_claim', expect.any(Object));
        });

        it('harus error jika claim tidak ditemukan', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            await expect(claimService.rejectClaim('123', reviewerId, notes)).rejects.toMatchObject({ status: 404 });
        });

        it('harus error jika verifikasi ZKP belum selesai (null)', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ 
                data: { zkp_proofs: { verification_result: null } }, 
                error: null 
            });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            await expect(claimService.rejectClaim('123', reviewerId, notes)).rejects.toMatchObject({ status: 409 });
        });

        it('harus error jika catatan penolakan kosong', async () => {
            await expect(claimService.rejectClaim('claim-123', reviewerId, '')).rejects.toThrow('review_notes wajib diisi');
        });

        it('harus error jika RPC reject_claim gagal', async () => {
            const mockMaybeSingle = jest.fn().mockResolvedValue({ 
                data: { zkp_proofs: { verification_result: false } }, 
                error: null 
            });
            supabaseMock.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            }));
            supabaseMock.rpc.mockResolvedValue({ error: { message: 'RPC Fail' } });
            await expect(claimService.rejectClaim('123', reviewerId, notes)).rejects.toThrow('RPC Fail');
        });
    });
});
