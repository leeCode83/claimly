import { PatientService } from './patient.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { poseidonHashArray } from '../zkp/poseidon';

// Mock ZKP poseidon
jest.mock('../zkp/poseidon', () => ({
    poseidonHashArray: jest.fn().mockReturnValue('mock-commitment-hash')
}));

describe('PatientService', () => {
    let service: PatientService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
        };

        service = new PatientService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getPatients', () => {
        const hospitalId = 'hosp-123';

        it('returns paginated patients with metadata', async () => {
            const mockData = [{ id: 'p1', full_name: 'John Doe' }];
            mockSupabase.order.mockResolvedValueOnce({ data: mockData, count: 25, error: null });

            const result = await service.getPatients({ hospitalId, page: 2, limit: 10 });

            expect(mockSupabase.from).toHaveBeenCalledWith('patients');
            expect(mockSupabase.eq).toHaveBeenCalledWith('hospital_id', hospitalId);
            expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
            expect(result.data).toEqual(mockData);
            expect(result.meta.total).toBe(25);
            expect(result.meta.total_pages).toBe(3);
        });

        it('applies search filter if provided', async () => {
            mockSupabase.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
            await service.getPatients({ hospitalId, search: 'Jane' });
            expect(mockSupabase.ilike).toHaveBeenCalledWith('full_name', '%Jane%');
        });

        it('throws 500 error on database failure', async () => {
            mockSupabase.order.mockResolvedValueOnce({ data: null, count: 0, error: { message: 'DB Error' } });
            await expect(service.getPatients({ hospitalId })).rejects.toThrow('DB Error');
        });
    });

    describe('createPatient', () => {
        const payload = {
            nik: '123456789',
            full_name: 'Patient X',
            birth_year: 1990,
            gender: 'M' as const
        };

        it('throws 400 if fields missing', async () => {
            await expect(service.createPatient({ nik: '' } as any, 'user1', 'hosp1'))
                .rejects.toThrow('Parameter nik, full_name, birth_year, dan gender wajib diisi');
        });

        it('creates patient with hashed NIK and correct metadata', async () => {
            const mockSaved = { id: 'new-p', ...payload };
            mockSupabase.single.mockResolvedValueOnce({ data: mockSaved, error: null });

            const result = await service.createPatient(payload, 'registrar-id', 'hosp-id');

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                full_name: payload.full_name,
                registered_by: 'registrar-id',
                hospital_id: 'hosp-id'
            }));
            // Verify Nik is hashed (check for some hex string)
            const insertCall = mockSupabase.insert.mock.calls[0][0];
            expect(insertCall.nik_hash).toBeDefined();
            expect(insertCall.nik_hash).not.toBe(payload.nik);
            expect(result).toEqual(mockSaved);
        });
    });

    describe('getPatientById', () => {
        it('returns patient with policies and nested insurance info', async () => {
            const mockData = { id: 'p1', full_name: 'John' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.getPatientById('p1');

            expect(mockSupabase.select).toHaveBeenCalledWith('*, patient_policies(*, insurance_policies(*))');
            expect(result).toEqual(mockData);
        });
    });

    describe('getPatientPoliciesByUserId', () => {
        const userId = 'auth-user-id';

        it('throws 404 if patient record not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
            await expect(service.getPatientPoliciesByUserId(userId)).rejects.toThrow('Patient record not found for this user');
        });

        it('returns list of policies with institution info', async () => {
            // 1. Mock Patient ID resolution
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'patient-id' }, error: null });
            // 2. Mock Policies query
            const mockPolicies = [{ id: 'pp1', insurance_policy: { name: 'Gold Plan', insurance_institution: { name: 'HealthCorp' } } }];
            mockSupabase.order.mockResolvedValueOnce({ data: mockPolicies, error: null });

            const result = await service.getPatientPoliciesByUserId(userId);

            expect(mockSupabase.from).toHaveBeenCalledWith('patients');
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
            
            // Check the policies query
            expect(mockSupabase.from).toHaveBeenCalledWith('patient_policies');
            expect(mockSupabase.eq).toHaveBeenCalledWith('patient_id', 'patient-id');
            expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
            expect(result).toEqual(mockPolicies);
        });
    });

    describe('createPatientPolicy', () => {
        const patientId = 'p1';
        const payload = {
            policy_id: 'pol-1',
            policy_number: 'POL123',
            start_date: '2024-01-01',
            end_date: '2025-01-01'
        };

        it('throws 400 if dates are invalid', async () => {
            await expect(service.createPatientPolicy(patientId, { ...payload, start_date: '2025-01-01', end_date: '2024-01-01' }))
                .rejects.toThrow('start_date harus lebih awal dari end_date');
        });

        it('throws 409 if patient already has an active policy', async () => {
            // Mock policy lookup success
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'pol-1', is_active: true }, error: null });
            // Mock active check returns an existing policy
            mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-pp' }, error: null });

            await expect(service.createPatientPolicy(patientId, payload))
                .rejects.toThrow('Pasien sudah memiliki polis aktif');
        });

        it('successfully creates policy with ZKP commitment', async () => {
            // 1. Mock insurance policy exists and active
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'pol-1', is_active: true }, error: null });
            // 2. Mock no existing active policy
            mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            // 3. Mock insert success
            const mockNewPP = { id: 'pp-99', ...payload, policy_commitment: 'mock-commitment-hash' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockNewPP, error: null });

            const result = await service.createPatientPolicy(patientId, payload);

            expect(poseidonHashArray).toHaveBeenCalled();
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                patient_id: patientId,
                policy_commitment: 'mock-commitment-hash',
                is_active: true
            }));
            expect(result).toEqual(mockNewPP);
        });
    });
});
