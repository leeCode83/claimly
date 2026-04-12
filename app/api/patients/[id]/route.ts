import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { PatientService } from "@/service/patient/patient.service";
import redis, { invalidateCache } from "@/lib/redis";

interface Profile {
    role: string;
    institution_id?: string;
}

interface Patient {
    hospital_id: string;
    user_id: string | null;
}

// Helper: cek apakah requester berhak mengakses data pasien ini
async function checkPatientAccess(requesterUserId: string, requesterProfile: Profile, patient: Patient): Promise<string | null> {
    if (requesterProfile.role === 'hospital_staff') {
        // hospital_staff hanya bisa akses pasien dari institusinya
        if (patient.hospital_id !== requesterProfile.institution_id) {
            return 'Forbidden: Anda hanya dapat mengakses pasien dari institusi Anda';
        }
        return null; // ok
    }

    if (requesterProfile.role === 'patient') {
        // Pasien yang mengakses datanya sendiri harus sudah memiliki akun (user_id tidak null)
        if (patient.user_id === null) {
            return 'Akses ditolak: Akun pasien ini belum terhubung ke user. Pasien perlu mendaftar akun terlebih dahulu.';
        }
        if (patient.user_id !== requesterUserId) {
            return 'Forbidden: Anda hanya dapat mengakses data pasien milik Anda sendiri';
        }
        return null; // ok
    }

    return 'Forbidden';
}

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

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        const requesterProfile = { role, institution_id };

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

        const accessError = await checkPatientAccess(user.id, requesterProfile as unknown as Profile, patient as unknown as Patient);
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

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        const requesterProfile = { role, institution_id };
        const patient = await patientService.getPatientById(id);

        const accessError = await checkPatientAccess(user.id, requesterProfile as unknown as Profile, patient as unknown as Patient);
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
