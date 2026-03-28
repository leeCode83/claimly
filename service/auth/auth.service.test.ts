import { AuthService } from './auth.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateUserKeypairForServer } from '@/lib/crypto/note-crypto';

// Mock crypto library
jest.mock('@/lib/crypto/note-crypto', () => ({
    generateUserKeypairForServer: jest.fn()
}));

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
            rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
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

        it('returns user data on success for non-patient role', async () => {
             const payload = { 
                 email: 'test@mail.com', 
                 password: '123', 
                 full_name: 'Staff User',
                 role: 'hospital_staff',
                 institution_id: 'inst-1'
             };
             const mockResult = { data: { user: { id: 'staff-1' } }, error: null };
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
             // Should NOT trigger crypto for hospital_staff
             expect(generateUserKeypairForServer).not.toHaveBeenCalled();
             expect(mockSupabase.rpc).not.toHaveBeenCalled();
             expect(result).toEqual(mockResult.data);
        });

        it('generates and saves keypair for patient role', async () => {
            const payload = { 
                email: 'patient@mail.com', 
                password: 'MySecurePassword', 
                full_name: 'Budi Pasien',
                role: 'patient'
            };
            
            const mockUser = { id: 'patient-uuid' };
            const mockResult = { data: { user: mockUser }, error: null };
            mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

            const mockKeypair = {
                publicKeyB64: 'pub-key',
                encryptedPrivKeyB64: 'enc-priv-key',
                saltB64: 'salt',
                ivB64: 'iv'
            };
            (generateUserKeypairForServer as jest.Mock).mockReturnValueOnce(mockKeypair);

            await service.signUp(payload);

            // Verify crypto was called with plaintext password
            expect(generateUserKeypairForServer).toHaveBeenCalledWith(payload.password);

            // Verify RPC was called to save the keypair
            expect(mockSupabase.rpc).toHaveBeenCalledWith('save_user_keypair', {
                p_public_key:           mockKeypair.publicKeyB64,
                p_encrypted_priv_key:   mockKeypair.encryptedPrivKeyB64,
                p_key_derivation_salt:  mockKeypair.saltB64,
                p_key_iv:               mockKeypair.ivB64,
            });
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
