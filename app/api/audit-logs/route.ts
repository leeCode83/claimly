import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { AuditLogService } from "@/service/audit-log/audit-log.service";
import redis from "@/lib/redis";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);

        if (role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden: Hanya admin yang dapat mengakses audit logs' },
                { status: 403 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const action = searchParams.get('action') || undefined;
        const entity_type = searchParams.get('entity_type') || undefined;
        const actor_id = searchParams.get('actor_id') || undefined;
        const date_from = searchParams.get('date_from') || undefined;
        const date_to = searchParams.get('date_to') || undefined;

        const auditLogService = new AuditLogService(supabase);

        const cacheKey = `audit-logs:page=${page}:limit=${limit}:action=${action || 'all'}:entity_type=${entity_type || 'all'}:actor=${actor_id || 'all'}:from=${date_from || 'none'}:to=${date_to || 'none'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar audit log",
                ...JSON.parse(cachedData),
            }, { status: 200 });
        }

        const result = await auditLogService.getAuditLogs({
            page,
            limit,
            action,
            entity_type,
            actor_id,
            date_from,
            date_to,
        });

        // Cache for 5 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

        return NextResponse.json({
            message: "Berhasil mengambil daftar audit log",
            ...result,
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
