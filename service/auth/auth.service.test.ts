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

        it('generates and saves keypair for ANY role by default', async () => {
             const payload = { 
                 email: 'staff@mail.com', 
                 password: 'StaffPassword123', 
                 full_name: 'Staff User',
                 role: 'hospital_staff',
                 institution_id: 'inst-1'
             };
             
             const mockUser = { id: 'staff-uuid' };
             const mockResult = { data: { user: mockUser }, error: null };
             mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

             const mockKeypair = {
                 publicKeyB64: 'pub-key-staff',
                 encryptedPrivKeyB64: 'enc-priv-key-staff',
                 saltB64: 'salt-staff',
                 ivB64: 'iv-staff'
             };
             (generateUserKeypairForServer as jest.Mock).mockReturnValueOnce(mockKeypair);

             await service.signUp(payload);
             
             // Verify Supabase signUp was called
             expect(mockSupabase.auth.signUp).toHaveBeenCalled();

             // Verify crypto was called for hospital_staff (Default behavior now)
             expect(generateUserKeypairForServer).toHaveBeenCalledWith(payload.password);

             // Verify RPC was called to save the keypair
             expect(mockSupabase.rpc).toHaveBeenCalledWith('save_user_keypair', {
                 p_public_key:           mockKeypair.publicKeyB64,
                 p_encrypted_priv_key:   mockKeypair.encryptedPrivKeyB64,
                 p_key_derivation_salt:  mockKeypair.saltB64,
                 p_key_iv:               mockKeypair.ivB64,
             });
        });

        it('skips server-side generation if client-side bundle is provided (Zero-Knowledge)', async () => {
            const clientBundle = {
                p_public_key: 'client-pub',
                p_encrypted_priv_key: 'client-enc-priv',
                p_key_derivation_salt: 'client-salt',
                p_key_iv: 'client-iv'
            };

            const payload = { 
                email: 'zkp@mail.com', 
                password: 'password123', 
                role: 'patient',
                ...clientBundle
            };
            
            const mockResult = { data: { user: { id: 'zkp-user' } }, error: null };
            mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

            await service.signUp(payload);

            // IMPORTANT: Should NOT call server-side generation
            expect(generateUserKeypairForServer).not.toHaveBeenCalled();

            // Should call RPC with the CLIENT's bundle
            expect(mockSupabase.rpc).toHaveBeenCalledWith('save_user_keypair', {
                p_public_key:           clientBundle.p_public_key,
                p_encrypted_priv_key:   clientBundle.p_encrypted_priv_key,
                p_key_derivation_salt:  clientBundle.p_key_derivation_salt,
                p_key_iv:               clientBundle.p_key_iv,
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

    describe('signOut', () => {
        it('returns success message on successful sign out', async () => {
            mockSupabase.auth.signOut = jest.fn().mockResolvedValueOnce({ error: null });

            const result = await service.signOut();

            expect(mockSupabase.auth.signOut).toHaveBeenCalled();
            expect(result).toEqual({ message: "Signed out successfully" });
        });

        it('throws a 400 error on sign out failure', async () => {
            const mockError = { message: 'Sign out failed' };
            mockSupabase.auth.signOut = jest.fn().mockResolvedValueOnce({ error: mockError });

            try {
                await service.signOut();
            } catch (err: any) {
                expect(err.message).toBe('Sign out failed');
                expect(err.status).toBe(400);
            }
        });
    });
});
