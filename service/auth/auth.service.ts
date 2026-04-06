import { SupabaseClient } from "@supabase/supabase-js";

export class AuthService {
    constructor(private supabase: SupabaseClient) {}

    /**
     * Initiates OAuth flow with Keycloak.
     * Returns the authorization URL for the client to redirect to.
     */
    async getOAuthLoginUrl(redirectTo?: string) {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'keycloak',
            options: {
                redirectTo: redirectTo || 'http://host.docker.internal:3000/api/auth/callback',
                skipBrowserRedirect: true, // Return URL instead of redirecting if called from server
            }
        });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        return data;
    }

    /**
     * Initializes ZKP keypair for a newly authenticated user.
     * Encryption must be performed on the client side before calling this.
     */
    async initializeZkpKeys(payload: { 
        p_public_key: string,
        p_encrypted_priv_key: string,
        p_key_derivation_salt: string,
        p_key_iv: string
    }) {
        const { error: rpcError } = await this.supabase.rpc('save_user_keypair', {
            p_public_key:           payload.p_public_key,
            p_encrypted_priv_key:   payload.p_encrypted_priv_key,
            p_key_derivation_salt:  payload.p_key_derivation_salt,
            p_key_iv:               payload.p_key_iv,
        });

        if (rpcError) {
            const err: any = new Error(rpcError.message);
            err.status = 400;
            throw err;
        }

        return { success: true };
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }
        return { message: "Signed out successfully" };
    }
}
