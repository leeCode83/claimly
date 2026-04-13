import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";
export const dynamic = 'force-dynamic';


export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff', 'patient'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const claimId = params.id;
        const body = await request.json();

        const claimService = new ClaimService(supabase);
        const result = await claimService.submitClaimProof(claimId, body);

        // Invalidate cache
        await redis.del(`claim:${claimId}:proof`);
        await redis.del(`claim:${claimId}`);

        return NextResponse.json(result, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' }, 
            { status: error.status || 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff', 'insurance_reviewer', 'patient', 'admin'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const claimId = params.id;

        const cacheKey = `claim:${claimId}:proof`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json(JSON.parse(cachedData), { status: 200 });
        }

        const claimService = new ClaimService(supabase);
        const proofData = await claimService.getClaimProof(claimId);

        // Cache for 30 minutes
        await redis.set(cacheKey, JSON.stringify(proofData), 'EX', 1800);

        return NextResponse.json(proofData, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' }, 
            { status: error.status || 500 }
        );
    }
}
