import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { InstitutionService } from "@/service/institution/institution.service";
import redis from "@/lib/crypto/redis";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const cacheKey = `institutions:page=${page || 'default'}:limit=${limit || 'default'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: `Berhasil mengambil daftar institusi (from cache)`,
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const institutionService = new InstitutionService(supabase);
        const result = await institutionService.getInstitutions({ page, limit });

        // Cache for 1 hour
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

        return NextResponse.json({
            message: `Berhasil mengambil daftar institusi`,
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const institutionService = new InstitutionService(supabase);
        const data = await institutionService.createInstitution(body);

        return NextResponse.json({ 
            message: "Institution successfully added",
            data: data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
