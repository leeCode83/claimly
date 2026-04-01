import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { ClaimService } from "@/service/claim/claim.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const sortBy = searchParams.get('sort_by') || 'submitted_at';
        const sortDir = searchParams.get('sort_dir') || 'desc';
        const status = searchParams.get('status') || undefined;
        const search = searchParams.get('search') || undefined;

        const claimService = new ClaimService(supabase);
        const result = await claimService.getClaims({ page, limit, sortBy, sortDir, status, search });

        return NextResponse.json({
            message: "Berhasil mengambil daftar klaim",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        if (requesterProfile.role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mengajukan klaim' }, { status: 403 });
        }

        const body = await request.json();

        const claimService = new ClaimService(supabase);
        const data = await claimService.submitClaim(body, user.id);

        return NextResponse.json({
            message: "Klaim berhasil diajukan dengan ZKP proof dari client",
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number; claim_id?: string };
        const response: Record<string, string | undefined> = { error: error.message || 'Internal Server Error' };
        if (error.claim_id) response.claim_id = error.claim_id;
        return NextResponse.json(response, { status: error.status || 500 });
    }
}
