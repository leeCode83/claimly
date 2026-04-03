import { SupabaseClient } from "@supabase/supabase-js";
import { generateUserKeypairForServer } from "@/lib/crypto/note-crypto";

export class AuthService {
    constructor(private supabase: SupabaseClient) {}

    async signIn(payload: { email?: string, password?: string }) {
        if (!payload.email || !payload.password) {
            const err: any = new Error("Email and password are required");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: payload.email,
            password: payload.password,
        });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 401;
            throw err;
        }

        return data;
    }

    async signUp(payload: { 
        email?: string, 
        password?: string, 
        full_name?: string, 
        role?: string, 
        institution_id?: string,
        // Optional client-side pre-generated keys (Zero-Knowledge)
        p_public_key?: string,
        p_encrypted_priv_key?: string,
        p_key_derivation_salt?: string,
        p_key_iv?: string
    }) {
        if (!payload.email || !payload.password) {
            const err: any = new Error("Email and password are required");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase.auth.signUp({
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

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        // Save keypair. 
        // Prioritize client-provided bundle, otherwise fallback to server generation.
        if (data.user) {
            try {
                let publicKey = payload.p_public_key;
                let encryptedPrivKey = payload.p_encrypted_priv_key;
                let salt = payload.p_key_derivation_salt;
                let iv = payload.p_key_iv;

                // Fallback to server-side generation if client didn't provide it
                if (!publicKey || !encryptedPrivKey || !salt || !iv) {
                    console.log("[AuthService.signUp] Client bundle missing, falling back to server-side key generation...");
                    const keypairBundle = generateUserKeypairForServer(payload.password);
                    publicKey = keypairBundle.publicKeyB64;
                    encryptedPrivKey = keypairBundle.encryptedPrivKeyB64;
                    salt = keypairBundle.saltB64;
                    iv = keypairBundle.ivB64;
                }

                const { error: rpcError } = await this.supabase.rpc('save_user_keypair', {
                    p_public_key:           publicKey,
                    p_encrypted_priv_key:   encryptedPrivKey,
                    p_key_derivation_salt:  salt,
                    p_key_iv:               iv,
                });

                if (rpcError) {
                    console.error('[AuthService.signUp] Gagal simpan keypair via RPC:', rpcError.message);
                }
            } catch (cryptoErr: any) {
                console.error('[AuthService.signUp] Crypto error saat menangani keypair:', cryptoErr.message);
            }
        }

        return data;
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
