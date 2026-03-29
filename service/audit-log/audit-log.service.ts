import { SupabaseClient } from "@supabase/supabase-js";

interface GetAuditLogsParams {
    page?: number;
    limit?: number;
    action?: string;
    entity_type?: string;
    actor_id?: string;
    date_from?: string;
    date_to?: string;
}

export class AuditLogService {
    constructor(private supabase: SupabaseClient) {}

    async getAuditLogs({
        page = 1,
        limit = 20,
        action,
        entity_type,
        actor_id,
        date_from,
        date_to,
    }: GetAuditLogsParams = {}) {
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('audit_logs')
            .select(`
                id,
                action,
                entity_type,
                entity_id,
                metadata,
                created_at,
                actor:users!actor_id(id, full_name, role)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (action) query = query.eq('action', action);
        if (entity_type) query = query.eq('entity_type', entity_type);
        if (actor_id) query = query.eq('actor_id', actor_id);
        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to);

        const { data, error, count } = await query;

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

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

    async getAuditLogsByEntity(
        entityType: string,
        entityId: string,
        { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
    ) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await this.supabase
            .from('audit_logs')
            .select(`
                id,
                action,
                entity_type,
                entity_id,
                metadata,
                created_at,
                actor:users!actor_id(id, full_name, role)
            `, { count: 'exact' })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

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
}
