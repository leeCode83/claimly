import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        const searchParams = request.nextUrl.searchParams;
        let hospitalInstitutionId: string | undefined = undefined;
        let patientIdFilter: string | undefined = undefined;

        if (requesterProfile.role === 'hospital_staff') {
            if (!requesterProfile.institution_id) {
                return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi' }, { status: 403 });
            }
            hospitalInstitutionId = requesterProfile.institution_id;
            patientIdFilter = searchParams.get('patient_id') || undefined;
        } else if (requesterProfile.role === 'patient') {
            // Pasien hanya boleh ambil data miliknya sendiri.
            // Ambil patient_id yang terhubung dengan user current.
            const { data: patientRecord, error: patientError } = await supabase
                .from('patients')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (patientError || !patientRecord) {
                return NextResponse.json({ error: 'Forbidden: Data profil pasien tidak ditemukan' }, { status: 403 });
            }
            patientIdFilter = patientRecord.id;
            // hospitalInstitutionId dibiarkan undefined agar pasien bisa melihat list dari semua RS (didukung oleh RLS).
        } else {
            return NextResponse.json({ error: 'Forbidden: Anda tidak diizinkan mengakses daftar rekam medis' }, { status: 403 });
        }
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const medicalRecordService = new MedicalRecordService(supabase);
        const result = await medicalRecordService.getMedicalRecords({
            hospitalInstitutionId,
            patientId: patientIdFilter,
            page,
            limit
        });

        return NextResponse.json({
            message: "Berhasil mengambil daftar rekam medis",
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
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat menginput rekam medis' }, { status: 403 });
        }

        if (!requesterProfile.institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi' }, { status: 403 });
        }

        const body = await request.json();

        const medicalRecordService = new MedicalRecordService(supabase);
        const data = await medicalRecordService.createMedicalRecord(
            body,
            requesterProfile.institution_id,
            user.id
        );

        return NextResponse.json({
            message: "Rekam medis berhasil ditambahkan",
            data
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
