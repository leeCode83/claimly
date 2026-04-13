import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import redis from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['admin'],
            requireInstitution: false // Global access
        });
        if (errorResponse) return errorResponse;

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const userService = new UserService(supabase);

        const cacheKey = `users:page=${page}:limit=${limit}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar user",
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const result = await userService.getUsers({ page, limit });

        // Cache for 15 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 900);

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
