import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { MedicalRecordService } from "@/service/medical-record/medical-record.service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        if (role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!institution_id) {
            return NextResponse.json({ error: 'Account not linked to an institution' }, { status: 403 });
        }

        const medicalRecordService = new MedicalRecordService(supabase);
        // Method name corresponds to service definition (no second argument)
        const data = await medicalRecordService.getMedicalRecordById(id);
        
        return NextResponse.json({
            message: "Berhasil mengambil detail rekam medis",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id);

        if (role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!institution_id) {
            return NextResponse.json({ error: 'Account not linked to an institution' }, { status: 403 });
        }

        const body = await request.json();

        const medicalRecordService = new MedicalRecordService(supabase);
        // Payload has notes and patientId (optional) for encryption
        const data = await medicalRecordService.updateMedicalRecord(id, body);

        return NextResponse.json({
            message: "Rekam medis berhasil diperbarui",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
