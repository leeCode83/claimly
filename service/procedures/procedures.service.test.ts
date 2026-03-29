import { ProceduresService } from './procedures.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('ProceduresService', () => {
    let service: ProceduresService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        service = new ProceduresService(mockSupabase as unknown as SupabaseClient);
    });

    describe('createProcedure', () => {
        it('throws an error if parameters are missing', async () => {
            const payload = { icd9_code: '', description: 'Test', default_max_coverage: 100 };
            await expect(service.createProcedure(payload)).rejects.toThrow('Parameter icd9_code, description, dan default_max_coverage wajib diisi');
        });

        it('throws an error if icd9_code format is invalid', async () => {
            const payload = { icd9_code: '!!!', description: 'Test', default_max_coverage: 100 };
            await expect(service.createProcedure(payload)).rejects.toThrow('Format icd9_code tidak valid');
        });

        it('returns data and encoded value on success', async () => {
            const payload = { icd9_code: '01.1', description: 'Test Procedure', default_max_coverage: 500000 };
            const mockData = [{ id: 1, ...payload }];
            mockSupabase.select.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.createProcedure(payload);
            
            expect(mockSupabase.from).toHaveBeenCalledWith('procedures');
            expect(result.data).toEqual(mockData[0]);
            expect(result.encoded_value).toBeDefined();
        });

        it('throws an error if Supabase insert fails', async () => {
            const payload = { icd9_code: '01.1', description: 'Test', default_max_coverage: 100 };
            mockSupabase.select.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });
            
            await expect(service.createProcedure(payload)).rejects.toThrow('Insert failed');
        });
    });

    describe('getProcedures', () => {
        it('throws a 500 error if query fails', async () => {
            mockSupabase.range.mockResolvedValueOnce({ data: null, error: { message: 'Fetch error' }, count: null });
            await expect(service.getProcedures()).rejects.toThrow('Fetch error');
        });

        it('returns an empty array if data is empty', async () => {
            mockSupabase.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });
            const result = await service.getProcedures();
            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
        });

        it('returns procedures on success', async () => {
            const mockData = [{ icd9_code: '01.1' }];
            mockSupabase.range.mockResolvedValueOnce({ data: mockData, error: null, count: 1 });
            const result = await service.getProcedures();
            expect(result.data).toEqual(mockData);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 1,
                total_pages: 1
            });
        });
    });

    describe('getProcedureByIcd', () => {
        it('throws a 404 if not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
            await expect(service.getProcedureByIcd('01.1')).rejects.toThrow('Not found');
        });

        it('returns procedure on success', async () => {
            const mockData = { icd9_code: '01.1' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });
            const result = await service.getProcedureByIcd('01.1');
            expect(result).toEqual(mockData);
        });
    });

    describe('updateProcedureByIcd', () => {
        it('throws error if payload empty', async () => {
            await expect(service.updateProcedureByIcd('01.1', {})).rejects.toThrow('Body request tidak boleh kosong untuk update');
        });

        it('returns updated data on success', async () => {
            const mockData = { icd9_code: '01.1', description: 'Updated' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });
            const result = await service.updateProcedureByIcd('01.1', { description: 'Updated' });
            expect(result).toEqual(mockData);
        });
    });

    describe('deleteProcedureByIcd', () => {
        it('returns deleted data on success', async () => {
            const mockData = { icd9_code: '01.1' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });
            const result = await service.deleteProcedureByIcd('01.1');
            expect(result).toEqual(mockData);
        });
    });

    describe('processBatchProcedures', () => {
        it('throws error if CSV empty', async () => {
            await expect(service.processBatchProcedures("code,description", 100)).rejects.toThrow('File CSV kosong atau tidak memiliki data (minimal ada header dan 1 baris data)');
        });

        it('processes CSV with coverage from column', async () => {
            const csv = "code,description,coverage\n01.1,Test,5000";
            mockSupabase.upsert.mockResolvedValueOnce({ error: null });
            const result = await service.processBatchProcedures(csv, null);
            expect(result.inserted_count).toBe(1);
            expect(mockSupabase.upsert).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ default_max_coverage: 5000 })]),
                { onConflict: 'icd9_integer_encoding' }
            );
        });

        it('uses fallbackCoverage if column missing', async () => {
            const csv = "code,description\n01.1,Test";
            mockSupabase.upsert.mockResolvedValueOnce({ error: null });
            const result = await service.processBatchProcedures(csv, 9999);
            expect(result.inserted_count).toBe(1);
            expect(mockSupabase.upsert).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ default_max_coverage: 9999 })]),
                { onConflict: 'icd9_integer_encoding' }
            );
        });

        it('reports invalid rows if coverage missing and no fallback', async () => {
            const csv = "code,description\n01.1,Test";
            try {
                await service.processBatchProcedures(csv, null);
            } catch (err: any) {
                expect(err.message).toBe('Tidak ada data valid yang dapat diinsert');
                expect(err.invalid_count).toBe(1);
            }
        });
    });
});
