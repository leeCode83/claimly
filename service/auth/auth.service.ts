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

    async signUp(payload: { email?: string, password?: string, full_name?: string, role?: string, institution_id?: string }) {
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

        // If role = "patient", generate keypair and save to DB via RPC
        if (payload.role === 'patient' && data.user) {
            try {
                const keypairBundle = generateUserKeypairForServer(payload.password);

                const { error: rpcError } = await this.supabase.rpc('save_user_keypair', {
                    p_public_key:           keypairBundle.publicKeyB64,
                    p_encrypted_priv_key:   keypairBundle.encryptedPrivKeyB64,
                    p_key_derivation_salt:  keypairBundle.saltB64,
                    p_key_iv:               keypairBundle.ivB64,
                });

                if (rpcError) {
                    console.error('[AuthService.signUp] Gagal simpan keypair:', rpcError.message);
                }
            } catch (cryptoErr: any) {
                console.error('[AuthService.signUp] Crypto error saat generate keypair:', cryptoErr.message);
            }
        }

        return data;
    }
}
