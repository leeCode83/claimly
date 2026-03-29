import { InstitutionService } from './institution.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('InstitutionService', () => {
    let service: InstitutionService;
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
            single: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        service = new InstitutionService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getInstitutions', () => {
        it('returns paginated data correctly', async () => {
            const mockData = [{ id: 'i1', name: 'Klinik A' }];
            mockSupabase.range.mockResolvedValueOnce({ data: mockData, count: 10, error: null });

            const result = await service.getInstitutions({ page: 1, limit: 5 });
            expect(result.data).toEqual(mockData);
            expect(result.pagination.total_pages).toBe(2);
        });

        it('throws an error on DB failure', async () => {
            mockSupabase.range.mockResolvedValueOnce({ error: { message: 'Query Failed' } });
            await expect(service.getInstitutions()).rejects.toThrow('Query Failed');
        });
    });

    describe('getInstitutionById', () => {
        it('returns a single institution', async () => {
            const mockData = { id: 'i1', name: 'RS B' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.getInstitutionById('i1');
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'i1');
            expect(result).toEqual(mockData);
        });
    });

    describe('createInstitution', () => {
        const payload = {
            name: 'Klinik C',
            type: 'hospital',
            license_number: 'LIC-001'
        };

        it('throws 400 if required parameters are missing', async () => {
            await expect(service.createInstitution({ name: '', type: 'hospital', license_number: '' }))
                .rejects.toThrow('Parameters name, type, and license_number are required');
        });

        it('throws 400 if type is invalid', async () => {
            await expect(service.createInstitution({ ...payload, type: 'pharmacy' }))
                .rejects.toThrow("type must be either 'hospital' or 'insurance'");
        });

        it('successfully creates an institution and returns the created data', async () => {
            const mockReturnedData = [{ id: 'new-id', ...payload }];
            mockSupabase.select.mockResolvedValueOnce({ data: mockReturnedData, error: null });

            const result = await service.createInstitution(payload);
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                name: payload.name,
                type: payload.type,
                license_number: payload.license_number,
                is_active: true
            }));
            expect(result).toEqual(mockReturnedData[0]);
        });
    });

    describe('updateInstitution', () => {
        it('throws 400 if update payload is empty', async () => {
            await expect(service.updateInstitution('i1', {})).rejects.toThrow('Request body cannot be empty for update');
        });

        it('throws 400 if update contains invalid type', async () => {
            await expect(service.updateInstitution('i1', { type: 'unknown' })).rejects.toThrow("type must be either 'hospital' or 'insurance'");
        });

        it('updates an institution successfully', async () => {
            const updatePayload = { name: 'Klinik Baru' };
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'i1', ...updatePayload }, error: null });

            const result = await service.updateInstitution('i1', updatePayload);
            expect(mockSupabase.update).toHaveBeenCalledWith(updatePayload);
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'i1');
            expect(result.name).toBe('Klinik Baru');
        });
    });

    describe('deleteInstitution', () => {
        it('deletes an institution successfully', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'i1' }, error: null });
            await service.deleteInstitution('i1');
            expect(mockSupabase.delete).toHaveBeenCalled();
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'i1');
        });
    });
});
