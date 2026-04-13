import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PatientService } from "@/service/patient/patient.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';

        const patientService = new PatientService(supabase);

        const cacheKey = `patients:inst=${institution_id}:page=${page}:limit=${limit}:search=${search || 'none'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar pasien",
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const result = await patientService.getPatients({ hospitalId: institution_id as string, page, limit, search });

        // Cache for 15 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 900);

        return NextResponse.json({
            message: "Berhasil mengambil daftar pasien",
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

        const { institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const body = await request.json();

        const patientService = new PatientService(supabase);
        const data = await patientService.createPatient(body, user.id, institution_id as string);

        // Invalidate cache
        await invalidateCache('patients');

        return NextResponse.json({
            message: "Pasien berhasil didaftarkan",
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
