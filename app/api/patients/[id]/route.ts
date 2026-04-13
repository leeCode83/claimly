import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PatientService } from "@/service/patient/patient.service";
import redis, { invalidateCache } from "@/lib/redis";
import { extractUserProfile, checkPatientAccess } from "@/lib/api-auth";
import { Patient } from "@/types/auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;

        const patientService = new PatientService(supabase);
        const requesterProfile = extractUserProfile(user);

        const cacheKey = `patient:${id}`;
        let patient = null;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            patient = JSON.parse(cachedData);
        } else {
            // Ambil data pasien dari DB jika tidak ada di cache
            patient = await patientService.getPatientById(id);
            // Cache for 15 minutes
            await redis.set(cacheKey, JSON.stringify(patient), 'EX', 900);
        }

        const accessError = await checkPatientAccess(user.id, requesterProfile, patient as unknown as Patient);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        return NextResponse.json({ data: patient }, { status: 200 });

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
        const body = await request.json();

        const patientService = new PatientService(supabase);

        const requesterProfile = extractUserProfile(user);
        const patient = await patientService.getPatientById(id);

        const accessError = await checkPatientAccess(user.id, requesterProfile, patient as unknown as Patient);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        const data = await patientService.updatePatient(id, body);

        // Invalidate cache
        await invalidateCache('patients');
        await redis.del(`patient:${id}`);

        return NextResponse.json({
            message: "Data pasien berhasil diupdate",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
