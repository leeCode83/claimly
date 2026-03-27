import { SupabaseClient } from "@supabase/supabase-js";

export class UserService {
    constructor(private supabase: SupabaseClient) {}

    async getUsers({ page = 1, limit = 10, search = '', role = '' }: { page?: number, limit?: number, search?: string, role?: string }) {
        let query = this.supabase
            .from('users')
            .select('*, institution:institutions(*)', { count: 'exact' });

        if (search) {
            query = query.ilike('full_name', `%${search}%`);
        }

        if (role) {
            query = query.eq('role', role);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to).order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        return {
            data,
            meta: {
                total: count || 0,
                page,
                limit,
                total_pages: Math.ceil((count || 0) / limit)
            }
        };
    }

    async getUserById(id: string) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*, institution:institutions(*)')
            .eq('id', id)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }

        return data;
    }

    async updateUser(id: string, payload: { role?: string, institution_id?: string | null }) {
        const updateData: any = {};
        if (payload.role !== undefined) updateData.role = payload.role;
        if (payload.institution_id !== undefined) updateData.institution_id = payload.institution_id;
        
        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
        } else {
             const err: any = new Error("Body request tidak boleh kosong untuk update");
             err.status = 400;
             throw err;
        }

        const { data, error } = await this.supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select('*, institution:institutions(*)')
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async deleteUser(id: string) {
        const { data, error } = await this.supabase
            .from('users')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async getMe(userId: string) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*, institution:institutions(*)')
            .eq('id', userId)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }

        return data;
    }
}
