import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userService = new UserService(supabase);
        
        // Cek admin role
        const currentUserProfile = await userService.getMe(user.id);
        if (currentUserProfile.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const role = searchParams.get('role') || '';

        const result = await userService.getUsers({ page, limit, search, role });

        return NextResponse.json({
            message: "Berhasil mengambil daftar user",
            ...result
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}
