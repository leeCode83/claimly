import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PolicyService } from "@/service/policy/policy.service";
import redis from "@/lib/redis";

export async function GET(request: NextRequest){
    try {
        const {supabase, user} = await getSupabaseServer(request);

        if(!user){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const cacheKey = `policies:page=${page || 'default'}:limit=${limit || 'default'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: `Berhasil mengambil daftar polis (from cache)`,
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const policyService = new PolicyService(supabase);
        const result = await policyService.getPolicies({ page, limit });

        // Cache for 1 hour
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

        return NextResponse.json({
            message: `Berhasil mengambil daftar polis`,
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
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = user.user_metadata?.role;
        if (role !== 'insurance_reviewer') {
            return NextResponse.json({ error: 'Forbidden: Hanya insurance_reviewer yang dapat membuat polis' }, { status: 403 });
        }

        const body = await request.json();
        
        const policyService = new PolicyService(supabase);
        const data = await policyService.createPolicy(user.id, body);

        return NextResponse.json({
            message: 'Policy created successfully',
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
