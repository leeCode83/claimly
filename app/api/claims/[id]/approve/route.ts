import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { ClaimService } from "@/service/claim/claim.service";

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        if (requesterProfile.role !== 'insurance_reviewer') {
            return NextResponse.json({ error: 'Forbidden: Hanya insurance_reviewer yang dapat menyetujui klaim' }, { status: 403 });
        }

        const params = await props.params;
        const claimId = params.id;
        const body = await request.json().catch(() => ({}));
        const reviewNotes = body.review_notes;

        const claimService = new ClaimService(supabase);
        const result = await claimService.approveClaim(claimId, user.id, reviewNotes);

        return NextResponse.json({
            message: "Klaim berhasil disetujui",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
