import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ProceduresService } from "@/service/procedures/procedures.service";
import redis from "@/lib/crypto/redis";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Dapatkan Authenticated Client & User secara terpusat
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const proceduresService = new ProceduresService(supabase);
        const result = await proceduresService.createProcedure(body);

        return NextResponse.json({ 
            message: "Prosedur berhasil ditambahkan",
            data: result.data,
            encoded_value: result.encoded_value 
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

export async function GET(request: NextRequest){
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if(!user){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const cacheKey = `procedures:page=${page || 'default'}:limit=${limit || 'default'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: `Berhasil mengambil daftar prosedur (from cache)`,
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const proceduresService = new ProceduresService(supabase);
        const result = await proceduresService.getProcedures({ page, limit });

        // Cache for 1 hour
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

        return NextResponse.json({
            message: `Berhasil mengambil daftar prosedur`,
            ...result
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}
