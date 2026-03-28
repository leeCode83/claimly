import { AuthService } from './auth.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('AuthService', () => {
    let service: AuthService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            auth: {
                signInWithPassword: jest.fn(),
                signUp: jest.fn(),
            },
        };

        service = new AuthService(mockSupabase as unknown as SupabaseClient);
    });

    describe('signIn', () => {
        it('throws an error if email or password missing', async () => {
            await expect(service.signIn({ email: 'test@mail.com' })).rejects.toThrow('Email and password are required');
            await expect(service.signIn({ password: '123' })).rejects.toThrow('Email and password are required');
        });

        it('returns user data on success', async () => {
             const payload = { email: 'test@mail.com', password: '123' };
             const mockResult = { data: { user: { id: 'user-1' } }, error: null };
             mockSupabase.auth.signInWithPassword.mockResolvedValueOnce(mockResult);

             const result = await service.signIn(payload);
             
             expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
                 email: payload.email,
                 password: payload.password
             });
             expect(result).toEqual(mockResult.data);
        });

        it('throws a 401 on auth failure', async () => {
             const payload = { email: 'test@mail.com', password: '123' };
             const mockResult = { data: null, error: { message: 'Invalid credentials' } };
             mockSupabase.auth.signInWithPassword.mockResolvedValueOnce(mockResult);

             try {
                 await service.signIn(payload);
             } catch(err: any) {
                 expect(err.message).toBe('Invalid credentials');
                 expect(err.status).toBe(401);
             }
        });
    });

    describe('signUp', () => {
        it('throws an error if email or password missing', async () => {
            await expect(service.signUp({ email: 'test@mail.com' })).rejects.toThrow('Email and password are required');
        });

        it('returns user data on success', async () => {
             const payload = { 
                 email: 'test@mail.com', 
                 password: '123', 
                 full_name: 'Test User',
                 role: 'PATIENT',
                 institution_id: 'inst-1'
             };
             const mockResult = { data: { user: { id: 'user-1' } }, error: null };
             mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

             const result = await service.signUp(payload);
             
             expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
                 email: payload.email,
                 password: payload.password,
                 options: {
                     data: {
                         full_name: payload.full_name,
                         role: payload.role,
                         institution_id: payload.institution_id
                     }
                 }
             });
             expect(result).toEqual(mockResult.data);
        });

        it('throws a 400 on sign up failure', async () => {
             const payload = { email: 'test@mail.com', password: '123' };
             const mockResult = { data: null, error: { message: 'User already exists' } };
             mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

             try {
                await service.signUp(payload);
             } catch(err: any) {
                 expect(err.message).toBe('User already exists');
                 expect(err.status).toBe(400);
             }
        });
    });
});
