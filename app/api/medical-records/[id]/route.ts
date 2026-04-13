import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;

        const { institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['patient', 'hospital_staff'], 
            requireInstitution: true 
        });
        if (errorResponse) return errorResponse;

        const medicalRecordService = new MedicalRecordService(supabase);

        const cacheKey = `medical-record:${id}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil detail rekam medis",
                data: JSON.parse(cachedData)
            }, { status: 200 });
        }

        // Method name corresponds to service definition (no second argument)
        const data = await medicalRecordService.getMedicalRecordById(id);
        
        // Cache for 10 minutes
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 600);

        return NextResponse.json({
            message: "Berhasil mengambil detail rekam medis",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;

        const { institution_id, errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['hospital_staff'], 
            requireInstitution: true 
        });
        if (errorResponse) return errorResponse;

        const body = await request.json();

        const medicalRecordService = new MedicalRecordService(supabase);
        // Payload has notes and patientId (optional) for encryption
        const data = await medicalRecordService.updateMedicalRecord(id, body);

        // Invalidate cache
        await invalidateCache('medical-records');
        await redis.del(`medical-record:${id}`);

        return NextResponse.json({
            message: "Rekam medis berhasil diperbarui",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
