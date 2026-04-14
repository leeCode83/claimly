import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { role, institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['patient', 'hospital_staff'], 
            requireInstitution: false 
        });
        if (errorResponse) return errorResponse;

        // Validasi institusi secara spesifik untuk staff
        if (role === 'hospital_staff' && !institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun staff belum terhubung ke instansi' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const patientId = searchParams.get('patient_id') || undefined;
        const search = searchParams.get('search') || undefined;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');
        const page = parseInt(searchParams.get('page') || '1');

        const medicalRecordService = new MedicalRecordService(supabase);

        // Cache key unik per user jika role-nya patient untuk menghindari kebocoran data
        // Sertakan semua parameter filter dalam cache key
        const filterStr = `s=${search || ''}:sd=${startDate || ''}:ed=${endDate || ''}`;
        const cacheKey = role === 'patient'
            ? `medical-records:user=${user.id}:${filterStr}:page=${page}:limit=${limit}`
            : `medical-records:inst=${institution_id || 'none'}:patient=${patientId || 'none'}:${filterStr}:page=${page}:limit=${limit}`;
            
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
            search,
            startDate,
            endDate,
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
