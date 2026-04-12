import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { DiagnosesService } from "@/service/diagnoses/diagnoses.service";
import redis, { invalidateCache } from "@/lib/redis";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);

        const cacheKey = `diagnosis:${icdCode}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({ 
                data: JSON.parse(cachedData) 
            }, { status: 200 });
        }

        const diagnosesService = new DiagnosesService(supabase);
        const data = await diagnosesService.getDiagnosisByIcd(icdCode);

        // Cache for 1 hour
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);

        return NextResponse.json({ data }, { status: 200 });
    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);
        
        const body = await request.json();

        const diagnosesService = new DiagnosesService(supabase);
        const data = await diagnosesService.updateDiagnosisByIcd(icdCode, body);

        // Invalidate cache
        await invalidateCache('diagnoses');
        await redis.del(`diagnosis:${icdCode}`);

        return NextResponse.json({ 
            message: "Diagnosa berhasil diupdate",
            data 
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);

        const diagnosesService = new DiagnosesService(supabase);
        const data = await diagnosesService.deleteDiagnosisByIcd(icdCode);

        // Invalidate cache
        await invalidateCache('diagnoses');
        await redis.del(`diagnosis:${icdCode}`);

        return NextResponse.json({ 
            message: "Diagnosa berhasil dihapus",
            data 
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
