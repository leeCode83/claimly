import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const userService = new UserService(supabase);
        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        
        // Authorization: hanya admin
        if (role !== 'admin') {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await userService.getUsers({ page, limit });

        return NextResponse.json({
            message: "Berhasil mengambil daftar user",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
