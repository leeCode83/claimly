import { SupabaseClient } from "@supabase/supabase-js";

export class InstitutionService {
    constructor(private supabase: SupabaseClient) {}

    async getInstitutions({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await this.supabase
            .from('institutions')
            .select('id, name, type, license_number', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        return {
            data,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                total_pages: Math.ceil((count ?? 0) / limit),
            },
        };
    }

    async getInstitutionById(id: string) {
        const { data, error } = await this.supabase
            .from('institutions')
            .select()
            .eq('id', id)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async createInstitution(payload: { name: string, type: string, license_number: string, address?: string, is_active?: boolean }) {
        if (!payload.name || !payload.type || !payload.license_number) {
            const err: any = new Error("Parameters name, type, and license_number are required");
            err.status = 400;
            throw err;
        }
        
        if (payload.type !== 'hospital' && payload.type !== 'insurance') {
            const err: any = new Error("type must be either 'hospital' or 'insurance'");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('institutions')
            .insert({ 
                name: payload.name, 
                type: payload.type, 
                license_number: payload.license_number, 
                address: payload.address || null,
                is_active: payload.is_active !== undefined ? payload.is_active : true
            })
            .select();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }
        return data[0];
    }

    async updateInstitution(id: string, updateData: any) {
        if (!updateData || Object.keys(updateData).length === 0) {
            const err: any = new Error("Request body cannot be empty for update");
            err.status = 400;
            throw err;
        }

        if (updateData.type && updateData.type !== 'hospital' && updateData.type !== 'insurance') {
             const err: any = new Error("type must be either 'hospital' or 'insurance'");
             err.status = 400;
             throw err;
        }

        const { data, error } = await this.supabase
            .from('institutions')
            .update(updateData)
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

    async deleteInstitution(id: string) {
        const { data, error } = await this.supabase
            .from('institutions')
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
}
