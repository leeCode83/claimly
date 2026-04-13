import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff', 'insurance_reviewer', 'patient', 'admin'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const sortBy = searchParams.get('sort_by') || 'submitted_at';
        const sortDir = searchParams.get('sort_dir') || 'desc';
        const status = searchParams.get('status') || undefined;
        const search = searchParams.get('search') || undefined;

        const claimService = new ClaimService(supabase);

        const cacheKey = `claims:page=${page}:limit=${limit}:sort=${sortBy}:${sortDir}:status=${status || 'all'}:search=${search || 'none'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar klaim",
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const result = await claimService.getClaims({ page, limit, sortBy, sortDir, status, search });

        // Cache for 5 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

        return NextResponse.json({
            message: "Berhasil mengambil daftar klaim",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        console.error('[GET Claims API Error]:', error.message, 'Status:', error.status);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const body = await request.json();

        const claimService = new ClaimService(supabase);
        const data = await claimService.submitClaim(body, user.id);

        // Invalidate cache
        await invalidateCache('claims');

        return NextResponse.json({
            message: "Klaim berhasil diajukan dengan ZKP proof dari client",
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number; claim_id?: string };
        // console.error('[POST Claims API Error]:', error.message, 'Status:', error.status);
        const response: Record<string, string | undefined> = { error: error.message || 'Internal Server Error' };
        if (error.claim_id) response.claim_id = error.claim_id;
        return NextResponse.json(response, { status: error.status || 500 });
    }
}
