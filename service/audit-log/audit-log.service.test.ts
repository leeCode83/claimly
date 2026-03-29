import { AuditLogService } from './audit-log.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('AuditLogService', () => {
    let service: AuditLogService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };
        
        // Define a then method to make it thenable (like a Promise)
        mockSupabase.then = jest.fn().mockImplementation(function(onFulfilled) {
            return Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled);
        });

        service = new AuditLogService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getAuditLogs', () => {
        it('returns paginated logs with proper metadata', async () => {
             const mockData = [{ id: '1', action: 'TEST_ACTION' }];
             mockSupabase.then.mockImplementationOnce(function(onFulfilled: any) {
                 return Promise.resolve({ data: mockData, count: 50, error: null }).then(onFulfilled);
             });
             
             const result = await service.getAuditLogs({ page: 2, limit: 10 });
             
             expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
             expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
             expect(result.data).toEqual(mockData);
             expect(result.pagination.total).toBe(50);
             expect(result.pagination.total_pages).toBe(5);
             expect(result.pagination.page).toBe(2);
        });

        it('throws 400 error when query fails', async () => {
             mockSupabase.then.mockImplementationOnce(function(onFulfilled: any) {
                 return Promise.resolve({ data: null, count: 0, error: { message: 'DB Exception' }}).then(onFulfilled);
             });
             await expect(service.getAuditLogs()).rejects.toThrow('DB Exception');
        });

        it('applies filters correctly if provided', async () => {
             mockSupabase.then.mockImplementationOnce(function(onFulfilled: any) {
                 return Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled);
             });
             
             await service.getAuditLogs({ 
                 action: 'CLAIM_SUBMITTED', 
                 entity_type: 'claims', 
                 actor_id: 'actor-123', 
                 date_from: '2026-01-01', 
                 date_to: '2026-12-31' 
             });
             
             expect(mockSupabase.eq).toHaveBeenCalledWith('action', 'CLAIM_SUBMITTED');
             expect(mockSupabase.eq).toHaveBeenCalledWith('entity_type', 'claims');
             expect(mockSupabase.eq).toHaveBeenCalledWith('actor_id', 'actor-123');
             expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
             expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2026-12-31');
        });
    });

    describe('getAuditLogsByEntity', () => {
        it('returns paginated logs specific to an entity', async () => {
            const mockData = [{ id: '2', action: 'STATUS_CHANGED' }];
            mockSupabase.then.mockImplementationOnce(function(onFulfilled: any) {
                return Promise.resolve({ data: mockData, count: 5, error: null }).then(onFulfilled);
            });
            
            const result = await service.getAuditLogsByEntity('claims', 'claim-123', { page: 1, limit: 10 });
            
            expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
            expect(mockSupabase.eq).toHaveBeenCalledWith('entity_type', 'claims');
            expect(mockSupabase.eq).toHaveBeenCalledWith('entity_id', 'claim-123');
            expect(mockSupabase.range).toHaveBeenCalledWith(0, 9);
            expect(result.data).toEqual(mockData);
            expect(result.pagination.total).toBe(5);
        });

        it('throws 400 error on database failure', async () => {
            mockSupabase.then.mockImplementationOnce(function(onFulfilled: any) {
                return Promise.resolve({ data: null, count: 0, error: { message: 'Entity Error' } }).then(onFulfilled);
            });
            await expect(service.getAuditLogsByEntity('patients', 'p1')).rejects.toThrow('Entity Error');
        });
    });
});
