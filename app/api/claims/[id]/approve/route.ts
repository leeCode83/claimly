import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";
import { invalidateCache } from "@/lib/redis";
import redis from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";
export const dynamic = 'force-dynamic';


export async function PATCH(
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
        const body = await request.json().catch(() => ({}));
        const reviewNotes = body.review_notes;

        const claimService = new ClaimService(supabase);
        const result = await claimService.approveClaim(claimId, user.id, reviewNotes);

        // Invalidate cache
        await invalidateCache('claims');
        await redis.del(`claim:${claimId}`);
        await invalidateCache('audit-logs');

        return NextResponse.json({
            message: "Klaim berhasil disetujui",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
