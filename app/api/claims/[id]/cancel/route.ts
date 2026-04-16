import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const claimId = params.id;
        const body = await request.json();

        const cancelReason = body.cancel_reason;
        if (!cancelReason || cancelReason.length < 10) {
            return NextResponse.json(
                { error: "Alasan pembatalan wajib diisi minimal 10 karakter" },
                { status: 400 }
            );
        }

        const claimService = new ClaimService(supabase);
        const result = await claimService.cancelClaim(claimId, user.id, cancelReason);

        return NextResponse.json(result, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}