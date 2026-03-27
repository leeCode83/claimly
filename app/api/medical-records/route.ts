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

        if (requesterProfile.role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat melihat daftar rekam medis' }, { status: 403 });
        }

        if (!requesterProfile.institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const patientId = searchParams.get('patient_id') || undefined;

        const medicalRecordService = new MedicalRecordService(supabase);
        const result = await medicalRecordService.getMedicalRecords({
            hospitalInstitutionId: requesterProfile.institution_id,
            patientId,
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
