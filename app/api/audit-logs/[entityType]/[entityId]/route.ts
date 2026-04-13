import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { AuditLogService } from "@/service/audit-log/audit-log.service";
import redis from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ entityType: string; entityId: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['admin', 'hospital_staff', 'insurance_reviewer'],
            requireInstitution: false
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const { entityType, entityId } = params;

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const auditLogService = new AuditLogService(supabase);

        const cacheKey = `audit-logs:${entityType}:${entityId}:page=${page || 1}:limit=${limit || 20}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: `Berhasil mengambil audit log untuk ${entityType} dengan id ${entityId}`,
                ...JSON.parse(cachedData),
            }, { status: 200 });
        }

        const result = await auditLogService.getAuditLogsByEntity(entityType, entityId, { page, limit });

        // Cache for 5 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

        return NextResponse.json({
            message: `Berhasil mengambil audit log untuk ${entityType} dengan id ${entityId}`,
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

