import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { PatientService } from "@/service/patient/patient.service";

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

        const userService = new UserService(supabase);
        const patientService = new PatientService(supabase);

        const requesterProfile = await userService.getMe(user.id);

        // Ambil data pasien dulu untuk pengecekan akses
        const patient = await patientService.getPatientById(id);

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

        const userService = new UserService(supabase);
        const patientService = new PatientService(supabase);

        const requesterProfile = await userService.getMe(user.id);
        const patient = await patientService.getPatientById(id);

        const accessError = await checkPatientAccess(user.id, requesterProfile as unknown as Profile, patient as unknown as Patient);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        const data = await patientService.updatePatient(id, body);

        return NextResponse.json({
            message: "Data pasien berhasil diupdate",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
