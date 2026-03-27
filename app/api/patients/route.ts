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

        if (requesterProfile.role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mengakses daftar pasien' }, { status: 403 });
        }

        if (!requesterProfile.institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi manapun' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';

        const patientService = new PatientService(supabase);
        const result = await patientService.getPatients({ hospitalId: requesterProfile.institution_id, page, limit, search });

        return NextResponse.json({
            message: "Berhasil mengambil daftar pasien",
            ...result
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        if (requesterProfile.role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mendaftarkan pasien' }, { status: 403 });
        }

        if (!requesterProfile.institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi manapun' }, { status: 403 });
        }

        const body = await request.json();

        const patientService = new PatientService(supabase);
        const data = await patientService.createPatient(body, user.id, requesterProfile.institution_id);

        return NextResponse.json({
            message: "Pasien berhasil didaftarkan",
            data
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
