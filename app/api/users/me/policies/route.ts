import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { PatientService } from "@/service/patient/patient.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        if (requesterProfile.role !== 'patient') {
            return NextResponse.json({ error: 'Forbidden: Hanya pasien yang dapat melihat daftar polis asuransi mereka sendiri' }, { status: 403 });
        }

        const patientService = new PatientService(supabase);
        const data = await patientService.getPatientPoliciesByUserId(user.id);

        return NextResponse.json({
            message: "Berhasil mengambil daftar polis asuransi Anda",
            data
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
