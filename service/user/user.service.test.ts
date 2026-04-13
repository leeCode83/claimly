import { UserService } from './user.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('UserService', () => {
    let service: UserService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        service = new UserService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getUsers', () => {
        it('returns paginated users successfully', async () => {
            mockSupabase.order.mockResolvedValueOnce({ data: [{ id: 'user1' }], count: 10, error: null });
            const result = await service.getUsers({ page: 1, limit: 10 });
            expect(result.data.length).toBe(1);
            expect(result.meta.total).toBe(10);
        });

        it('applies search and role filters appropriately', async () => {
            mockSupabase.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
            await service.getUsers({ search: 'John', role: 'admin' });
            expect(mockSupabase.ilike).toHaveBeenCalledWith('full_name', '%John%');
            expect(mockSupabase.eq).toHaveBeenCalledWith('role', 'admin');
        });
        
        it('throws 500 error when query fails', async () => {
            mockSupabase.order.mockResolvedValueOnce({ error: { message: 'db error' }});
            await expect(service.getUsers({})).rejects.toThrow('db error');
        });
    });

    describe('getUserById & getMe', () => {
        it('queries correct user by ID', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'u1' }, error: null });
            await service.getUserById('u1');
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'u1');
        });

        it('queries getMe correctly', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'me' }, error: null });
            await service.getMe('me');
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'me');
        });
    });

    describe('updateUser', () => {
        it('throws 403 if requesterId does not match user id', async () => {
            await expect(service.updateUser('u1', 'u2', { full_name: 'New Name' }))
                .rejects.toThrow('Forbidden: Anda hanya bisa mengupdate profil Anda sendiri');
        });

        it('throws 400 if empty data is provided', async () => {
            await expect(service.updateUser('u1', 'u1', {}))
                .rejects.toThrow('Body request tidak boleh kosong untuk update (field: full_name)');
        });

        it('injects updated_at field and updates full_name', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'u1', full_name: 'John Doe' }, error: null });
            await service.updateUser('u1', 'u1', { full_name: 'John Doe' });
            
            const updateCall = mockSupabase.update.mock.calls[0][0];
            expect(updateCall.full_name).toBe('John Doe');
            expect(updateCall.updated_at).toBeDefined();
            expect(updateCall.role).toBeUndefined();
            expect(updateCall.institution_id).toBeUndefined();
        });
    });

    describe('deleteUser', () => {
        it('deletes user successfully', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'u1' }, error: null });
            await service.deleteUser('u1');
            expect(mockSupabase.delete).toHaveBeenCalled();
        });
    });
});
