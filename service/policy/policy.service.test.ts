import { PolicyService } from './policy.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { buildMerkleTree } from '@/service/zkp';

jest.mock('@/service/zkp', () => ({
    buildMerkleTree: jest.fn().mockResolvedValue({ 
        root: 'mock-root', 
        leaves: [{ encoding: 101, index: 0, hash: 'h1' }] 
    })
}));

describe('PolicyService', () => {
    let service: PolicyService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        service = new PolicyService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getPolicies', () => {
        it('returns paginated data', async () => {
            mockSupabase.range.mockResolvedValueOnce({ data: [], count: 0, error: null });
            const result = await service.getPolicies({ page: 1, limit: 10 });
            expect(result.data).toEqual([]);
        });
    });

    describe('getPolicyById', () => {
        it('returns policy correctly', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'pol1' }, error: null });
            const result = await service.getPolicyById('pol1');
            expect(result.id).toBe('pol1');
        });
    });

    describe('createPolicy', () => {
        const payload = {
            policy_name: 'Health Guard',
            max_coverage_amount: 1000000,
            valid_from: '2024-01-01',
            valid_until: '2025-01-01',
            diagnosis_codes: ['D01'],
            procedure_codes: ['P01']
        };

        it('throws 400 if inputs are incomplete', async () => {
            await expect(service.createPolicy('u1', { policy_name: '' })).rejects.toThrow('Invalid payload or empty references');
        });

        it('throws 403 if user is not insurance_reviewer', async () => {
            // Mock get user profile
            mockSupabase.single.mockResolvedValueOnce({ data: { institution_id: 'i1', role: 'admin' }, error: null });
            await expect(service.createPolicy('u1', payload)).rejects.toThrow('Forbidden: Only insurance reviewers can create policies');
        });

        it('throws 400 if user has no institution', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { institution_id: null, role: 'insurance_reviewer' }, error: null });
            await expect(service.createPolicy('u1', payload)).rejects.toThrow('User does not belong to any institution');
        });

        it('throws 400 if diagnosis codes references are invalid', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { institution_id: 'i1', role: 'insurance_reviewer' }, error: null });
            // For diagnosis lookup, return empty (code not found)
            mockSupabase.in.mockResolvedValueOnce({ data: [], error: null });
            await expect(service.createPolicy('u1', payload)).rejects.toThrow('Invalid diagnosis codes: D01');
        });

        it('successfully creates policy and junction tables', async () => {
            // 1. user profile
            mockSupabase.single.mockResolvedValueOnce({ data: { institution_id: 'i1', role: 'insurance_reviewer' }, error: null });
            
            // 2. lookup diagnoses
            mockSupabase.in.mockResolvedValueOnce({ data: [{ id: 'd1', icd10_integer_encoding: 101, icd10_code: 'D01' }], error: null });
            
            // 3. lookup procedures
            mockSupabase.in.mockResolvedValueOnce({ data: [{ id: 'p1', icd9_integer_encoding: 101, icd9_code: 'P01' }], error: null });
            
            // 4. insert insurance_policies -> select -> single
            // Note: insert() must return 'this' for chaining to .select()
            mockSupabase.insert.mockReturnThis();
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new-policy-id' }, error: null });
            
            const result = await service.createPolicy('u1', payload);

            expect(buildMerkleTree).toHaveBeenCalledTimes(2); // once for diagnosis, once for procedure
            expect(mockSupabase.from).toHaveBeenCalledWith('insurance_policies');
            expect(mockSupabase.from).toHaveBeenCalledWith('policy_covered_diagnoses');
            expect(mockSupabase.from).toHaveBeenCalledWith('policy_covered_procedures');
            expect(result).toEqual({ id: 'new-policy-id' });
        });
    });

    describe('updatePolicy', () => {
        it('throws 400 if payload is empty or invalid', async () => {
            await expect(service.updatePolicy('pol1', {})).rejects.toThrow('Request body cannot be empty for update');
            await expect(service.updatePolicy('pol1', { unknown_param: '123' })).rejects.toThrow('No valid fields to update');
        });

        it('updates specified valid fields', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'p1', policy_name: 'Updated Name' }, error: null });
            const result = await service.updatePolicy('p1', { policy_name: 'Updated Name', invalid_field: 'x' });
            
            expect(mockSupabase.update).toHaveBeenCalledWith({ policy_name: 'Updated Name' });
            expect(result.policy_name).toBe('Updated Name');
        });
    });

    describe('deletePolicy', () => {
        it('deletes policy correctly', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'p1' }, error: null });
            await service.deletePolicy('p1');
            expect(mockSupabase.delete).toHaveBeenCalled();
        });
    });
});
