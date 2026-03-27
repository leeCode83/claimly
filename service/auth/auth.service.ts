import { SupabaseClient } from "@supabase/supabase-js";

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

        return data;
    }
}
