import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['patient', 'hospital_staff'], 
            requireInstitution: true 
        });
        if (errorResponse) return errorResponse;

        const searchParams = request.nextUrl.searchParams;
        const patientId = searchParams.get('patient_id') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');
        const page = parseInt(searchParams.get('page') || '1');

        const medicalRecordService = new MedicalRecordService(supabase);

        const cacheKey = `medical-records:inst=${institution_id || 'none'}:patient=${patientId || 'none'}:page=${page}:limit=${limit}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar rekam medis",
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        // Method name is getMedicalRecords, and it uses hospitalInstitutionId
        const result = await medicalRecordService.getMedicalRecords({ 
            hospitalInstitutionId: institution_id ?? undefined, 
            patientId,
            limit, 
            page 
        });

        // Cache for 10 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 600);

        return NextResponse.json({
            message: "Berhasil mengambil daftar rekam medis",
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

        const medicalRecordService = new MedicalRecordService(supabase);
        // Arguments: payload, hospitalInstitutionId, attendingDoctorId
        const data = await medicalRecordService.createMedicalRecord(body, institution_id as string, user.id);

        // Invalidate cache
        await invalidateCache('medical-records');

        return NextResponse.json({
            message: "Rekam medis berhasil dibuat",
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
