import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";
import redis from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";
export const dynamic = 'force-dynamic';


export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { role, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff', 'insurance_reviewer', 'patient', 'admin'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const claimId = params.id;

        const cacheKey = `claim:${claimId}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({ 
                data: JSON.parse(cachedData) 
            }, { status: 200 });
        }

        const claimService = new ClaimService(supabase);
        // Visibility per role dikontrol oleh RLS yang sudah ada di DB
        const data = await claimService.getClaimById(claimId);

        // Cache for 5 minutes
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);

        return NextResponse.json({ data }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
