import { AuthService } from './auth.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('AuthService', () => {
    let service: AuthService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSupabase = {
            auth: {
                signInWithOAuth: jest.fn(),
                signOut: jest.fn(),
            },
            rpc: jest.fn(),
        };

        service = new AuthService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getOAuthLoginUrl', () => {
        it('berhasil melakukan sign in dengan provider keycloak', async () => {
            const mockData = { provider: 'keycloak', url: 'http://keycloak-auth-url' };
            mockSupabase.auth.signInWithOAuth.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.getOAuthLoginUrl();

            expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
                provider: 'keycloak',
                options: expect.objectContaining({
                    skipBrowserRedirect: true,
                    scopes: 'openid profile email'
                })
            });
            expect(result).toEqual(mockData);
        });

        it('menggunakan redirectTo yang spesifik jika diberikan', async () => {
            mockSupabase.auth.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: null });
            const redirectTo = 'http://custom-redirect';

            await service.getOAuthLoginUrl(undefined, redirectTo);

            expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
                options: expect.objectContaining({ redirectTo })
            }));
        });

        it('melempar error jika signInWithOAuth gagal', async () => {
            mockSupabase.auth.signInWithOAuth.mockResolvedValueOnce({ data: null, error: { message: 'OAuth error' } });

            await expect(service.getOAuthLoginUrl()).rejects.toThrow('OAuth error');
        });
    });

    describe('initializeZkpKeys', () => {
        const payload = {
            p_public_key: 'pub-key',
            p_encrypted_priv_key: 'enc-priv',
            p_key_derivation_salt: 'salt',
            p_key_iv: 'iv'
        };

        it('berhasil memanggil RPC save_user_keypair', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ error: null });

            const result = await service.initializeZkpKeys(payload);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('save_user_keypair', payload);
            expect(result).toEqual({ success: true });
        });

        it('melempar error jika RPC gagal', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ error: { message: 'RPC failure' } });

            await expect(service.initializeZkpKeys(payload)).rejects.toThrow('RPC failure');
        });
    });

    describe('signOut', () => {
        it('berhasil melakukan sign out', async () => {
            mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });

            const result = await service.signOut();

            expect(mockSupabase.auth.signOut).toHaveBeenCalled();
            expect(result).toEqual({ message: "Signed out successfully" });
        });

        it('melempar error jika sign out gagal', async () => {
             mockSupabase.auth.signOut.mockResolvedValueOnce({ error: { message: 'Sign out failed' } });

             await expect(service.signOut()).rejects.toThrow('Sign out failed');
        });
    });
});
