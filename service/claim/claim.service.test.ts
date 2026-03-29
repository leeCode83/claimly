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

    describe('submitClaim', () => {
        const mockPayload = {
            patient_policy_id: 'policy-123',
            medical_record_id: 'mr-123',
            procedure_id: 'proc-123',
            procedure_date: '2026-03-20',
            claim_amount: 500000,
        };
        const submitterId = 'user-123';

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

        const setupHappyMocks = (overrides = {}) => {
            const medRecord = { diagnosis_date_encoded: 20260315, diagnosis: { icd10_integer_encoding: 123 } };
            const patientPolicy = {
                start_date: '2026-01-01',
                end_date: '2026-12-31',
                insurance_policies: { id: 'ins-123', approved_diagnosis_root: 'rootA', approved_procedure_root: 'rootB' }
            };
            const procedure = { default_max_coverage: 1000000, icd9_integer_encoding: 456 };

            supabaseMock.from().single
                .mockResolvedValueOnce({ data: medRecord, error: null }) // mrRes
                .mockResolvedValueOnce({ data: patientPolicy, error: null }) // ppRes
                .mockResolvedValueOnce({ data: procedure, error: null }); // procRes

            (generateProof as jest.Mock).mockResolvedValue({ proof: { pi_a: [] }, publicSignals: ['1'] });
            (getMerklePath as jest.Mock).mockResolvedValue({ pathElements: [], pathIndices: [] });

            // Mock table claims.insert().select().single()
            supabaseMock.from().single.mockResolvedValueOnce({ data: { id: 'claim-123', status: 'submitted' }, error: null });
            
            // Mock table zkp_proofs.insert() - error di mock insert builder
             supabaseMock.from().insert.mockImplementation((data: any) => {
                 return {
                     select: jest.fn().mockReturnThis(),
                     single: jest.fn().mockResolvedValue({ data: { ...data, id: 'claim-123' }, error: null }),
                     error: null
                 };
            });
            // We need to return error explicitly for zkp_proof error tests, but returning {error: null} by default
            supabaseMock.from.mockImplementation((table: string) => {
                const builder = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn(),
                    insert: jest.fn().mockResolvedValue({ error: null }), // For zkp_proof insert
                    delete: jest.fn().mockReturnThis()
                };
                
                if (table === 'medical_records') builder.single.mockResolvedValue({ data: medRecord, error: null });
                if (table === 'patient_policies') builder.single.mockResolvedValue({ data: patientPolicy, error: null });
                if (table === 'procedures') builder.single.mockResolvedValue({ data: procedure, error: null });
                if (table === 'policy_covered_diagnoses' || table === 'policy_covered_procedures') {
                    // For buildZKPInputPayload promise.all
                    builder.eq = jest.fn().mockResolvedValue({ data: [], error: null });
                }
                if (table === 'claims') {
                    builder.insert = jest.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'claim-123' }, error: null }) }) });
                }
                return builder;
            });
            
            return { medRecord, patientPolicy, procedure };
        };

        it('harus melempar error temporal jika procedure_date < diagnosis_date', async () => {
            setupHappyMocks();
            // 2026-03-20 -> encoded: 20260320. Make diagnosis after procedure.
            supabaseMock.from.mockImplementation((table: string) => {
                const builder: any = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
                if (table === 'medical_records') builder.single = jest.fn().mockResolvedValue({ data: { diagnosis_date_encoded: 20260325 }, error: null });
                if (table === 'patient_policies') builder.single = jest.fn().mockResolvedValue({ data: { start_date: '2026-01-01', end_date: '2026-12-31', insurance_policies: { approved_diagnosis_root: '1', approved_procedure_root: '2' } }, error: null });
                if (table === 'procedures') builder.single = jest.fn().mockResolvedValue({ data: { default_max_coverage: 1000000 }, error: null });
                return builder;
            });

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Tanggal prosedur tidak boleh lebih awal dari tanggal diagnosa.');
        });

        it('harus melempar error limit jika claim_amount melebihi max_coverage', async () => {
             supabaseMock.from.mockImplementation((table: string) => {
                const builder: any = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
                if (table === 'medical_records') builder.single = jest.fn().mockResolvedValue({ data: { diagnosis_date_encoded: 20260310 }, error: null });
                if (table === 'patient_policies') builder.single = jest.fn().mockResolvedValue({ data: { start_date: '2026-01-01', end_date: '2026-12-31', insurance_policies: { approved_diagnosis_root: '1', approved_procedure_root: '2' } }, error: null });
                if (table === 'procedures') builder.single = jest.fn().mockResolvedValue({ data: { default_max_coverage: 100000 }, error: null }); // Limit 100rb, claim 500rb
                return builder;
            });

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('Validasi Gagal: Nominal klaim melebihi batas pertanggungan maksimal');
        });

        it('harus melempar error dan tidak menyimpan apapun ke database jika generateProof gagal di tengah jalan', async () => {
            setupHappyMocks();
            (generateProof as jest.Mock).mockRejectedValueOnce(new Error('Circuit assert fail'));

            await expect(claimService.submitClaim(mockPayload, submitterId)).rejects.toThrow('ZKP proof generation gagal: Circuit assert fail');
            
            // Ensure claims.insert was NEVER called because validation and ZKP happens before DB claims insertion
            const claimsInsertCalls = supabaseMock.from.mock.calls.filter((call: any) => call[0] === 'claims');
            // Mock builder's insert method should not be called
            expect(supabaseMock.from('claims').insert).not.toHaveBeenCalled();
        });

        it('berhasil melakukan submisi claim dengan validasi lolos dan zkp terbentuk', async () => {
            setupHappyMocks();

            const result = await claimService.submitClaim(mockPayload, submitterId);
            
            expect(result).toBeDefined();
            expect(result.id).toBe('claim-123');
            expect(generateProof).toHaveBeenCalled();
            // Verify claims and zkp_proofs were inserted
            expect(supabaseMock.from).toHaveBeenCalledWith('claims');
            expect(supabaseMock.from).toHaveBeenCalledWith('zkp_proofs');
        });
    });

    // ... additional tests for getClaims, approveClaim, rejectClaim ...
});
