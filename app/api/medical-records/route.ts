import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        if (role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mencari rekam medis' }, { status: 403 });
        }

        if (!institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi manapun' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const patientId = searchParams.get('patient_id') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');
        const page = parseInt(searchParams.get('page') || '1');

        const medicalRecordService = new MedicalRecordService(supabase);
        // Method name is getMedicalRecords, and it uses hospitalInstitutionId
        const result = await medicalRecordService.getMedicalRecords({ 
            hospitalInstitutionId: institution_id, 
            patientId,
            limit, 
            page 
        });

        return NextResponse.json({
            message: "Berhasil mengambil daftar rekam medis",
            ...result
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        if (role !== 'hospital_staff') {
            console.log(role)
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat membuat rekam medis' }, { status: 403 });
        }

        if (!institution_id) {
            return NextResponse.json({ error: 'Forbidden: Akun Anda belum terhubung ke institusi manapun' }, { status: 403 });
        }

        const body = await request.json();

        const medicalRecordService = new MedicalRecordService(supabase);
        // Arguments: payload, hospitalInstitutionId, attendingDoctorId
        const data = await medicalRecordService.createMedicalRecord(body, institution_id, user.id);

        return NextResponse.json({
            message: "Rekam medis berhasil dibuat",
            data
        }, { status: 201 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
