import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { PatientService } from "@/service/patient/patient.service";

function checkPatientAccess(requesterUserId: string, requesterProfile: any, patient: any): string | null {
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

        const userService = new UserService(supabase);
        const patientService = new PatientService(supabase);

        const requesterProfile = await userService.getMe(user.id);
        const patient = await patientService.getPatientById(patientId);

        const accessError = checkPatientAccess(user.id, requesterProfile, patient);
        if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

        const data = await patientService.getPatientPolicies(patientId);

        return NextResponse.json({
            message: `Ditemukan ${data?.length || 0} polis untuk pasien ini`,
            data
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
