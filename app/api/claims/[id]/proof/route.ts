import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";

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

        const role = user.user_metadata?.role;
        if (role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mengirimkan proof klaim' }, { status: 403 });
        }

        const claimService = new ClaimService(supabase);
        const result = await claimService.submitClaimProof(claimId, body);

        return NextResponse.json(result, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' }, 
            { status: error.status || 500 }
        );
    }
}
