import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { ClaimService } from "@/service/claim/claim.service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const claimId = params.id;

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        // Roles yang diperbolehkan: hospital_staff, insurance_reviewer, patient
        const allowedRoles = ['hospital_staff', 'insurance_reviewer', 'patient', 'admin'];
        if (!allowedRoles.includes(requesterProfile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const claimService = new ClaimService(supabase);
        // Visibility per role dikontrol oleh RLS yang sudah ada di DB
        const data = await claimService.getClaimById(claimId);

        return NextResponse.json({ data }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
