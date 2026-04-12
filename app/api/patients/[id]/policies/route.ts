import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
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

function checkPatientAccess(requesterUserId: string, requesterProfile: Profile, patient: Patient): string | null {
    if (requesterProfile.role === 'hospital_staff') {
        if (patient.hospital_id !== requesterProfile.institution_id) {
            return 'Forbidden: Anda hanya dapat mengakses pasien dari institusi Anda';
        }
        return null;
    }

    if (requesterProfile.role === 'patient') {
        if (patient.user_id === null) {
            return 'Akses ditolak: Akun pasien ini belum terhubung ke user. Pasien perlu mendaftar akun terlebih dahulu.';
        }
        if (patient.user_id !== requesterUserId) {
            return 'Forbidden: Anda hanya dapat mengakses data pasien milik Anda sendiri';
        }
        return null;
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
        const patientId = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        const patientService = new PatientService(supabase);
        const patient = await patientService.getPatientById(patientId);

        const requesterProfile = { role, institution_id };
        const accessError = checkPatientAccess(user.id, requesterProfile as unknown as Profile, patient as unknown as Patient);
        if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const cacheKey = `patient:${patientId}:policies:page=${page || 1}:limit=${limit || 10}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: `Berhasil mengambil daftar polis untuk pasien ini`,
                ...JSON.parse(cachedData)
            }, { status: 200 });
        }

        const result = await patientService.getPatientPolicies(patientId, { page, limit });

        // Cache for 15 minutes
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 900);

        return NextResponse.json({
            message: `Berhasil mengambil daftar polis untuk pasien ini`,
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const patientId = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        const patientService = new PatientService(supabase);

        // Hanya hospital_staff yang boleh mendaftarkan pasien ke polis
        if (role !== 'hospital_staff') {
            return NextResponse.json(
                { error: 'Forbidden: Hanya hospital_staff yang dapat mendaftarkan pasien ke polis' },
                { status: 403 }
            );
        }

        // Pastikan hospital_staff ini dari institusi yang mengelola pasien tersebut
        const patient = await patientService.getPatientById(patientId);
        const requesterProfile = { role, institution_id };
        const accessError = checkPatientAccess(user.id, requesterProfile as unknown as Profile, patient as unknown as Patient);
        if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

        const body = await request.json();
        const data = await patientService.createPatientPolicy(patientId, body);

        // Invalidate cache
        await invalidateCache(`patient:${patientId}:policies`);
        await invalidateCache(`user:`); // My profiles policies might change

        return NextResponse.json({
            message: 'Pasien berhasil didaftarkan ke polis',
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
