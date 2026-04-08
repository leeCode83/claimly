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

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);

        if (role !== 'insurance_reviewer') {
            return NextResponse.json({ error: 'Forbidden: Hanya insurance_reviewer yang dapat memverifikasi proof klaim' }, { status: 403 });
        }

        const params = await props.params;
        const claimId = params.id;

        const claimService = new ClaimService(supabase);
        const result = await claimService.requestVerification(claimId);

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
