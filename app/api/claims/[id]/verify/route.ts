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
            allowedRoles: ['insurance_reviewer'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const claimId = params.id;

        const claimService = new ClaimService(supabase);
        const result = await claimService.requestVerification(claimId);

        // Invalidate cache
        await invalidateCache('claims');
        await redis.del(`claim:${claimId}`);
        await redis.del(`claim:${claimId}:proof`);

        const isAlreadyVerified = result.status === "already_verified";
        return NextResponse.json({
            message: isAlreadyVerified 
                ? "Proof sudah diverifikasi sebelumnya"
                : "Permintaan verifikasi diterima. Hasil akan tersedia via Supabase Realtime.",
            data: result
        }, { status: isAlreadyVerified ? 200 : 202 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
