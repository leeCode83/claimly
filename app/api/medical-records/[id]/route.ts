import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { PatientService } from "@/service/patient/patient.service";
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

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        const medicalRecordService = new MedicalRecordService(supabase);
        const record = await medicalRecordService.getMedicalRecordById(id);

        if (requesterProfile.role === 'hospital_staff') {
            // hospital_staff hanya bisa akses rekam medis institusinya sendiri
            if (record.hospital_institution_id !== requesterProfile.institution_id) {
                return NextResponse.json({ error: 'Forbidden: Anda hanya dapat mengakses rekam medis dari institusi Anda' }, { status: 403 });
            }
        } else if (requesterProfile.role === 'patient') {
            // Pasien hanya bisa akses rekam medisnya sendiri (lewat patient.user_id)
            const patientService = new PatientService(supabase);
            const patient = await patientService.getPatientById(record.patient_id);

            if (patient.user_id === null) {
                return NextResponse.json({ error: 'Akses ditolak: Pasien terkait belum memiliki akun terdaftar' }, { status: 403 });
            }
            if (patient.user_id !== user.id) {
                return NextResponse.json({ error: 'Forbidden: Anda hanya bisa mengakses rekam medis Anda sendiri' }, { status: 403 });
            }
        } else {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ data: record }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        if (requesterProfile.role !== 'hospital_staff') {
            return NextResponse.json({ error: 'Forbidden: Hanya hospital_staff yang dapat mengupdate rekam medis' }, { status: 403 });
        }

        const params = await props.params;
        const id = params.id;
        const body = await request.json();

        const medicalRecordService = new MedicalRecordService(supabase);

        // Pastikan rekam medis milik institusi yang sama
        const record = await medicalRecordService.getMedicalRecordById(id);
        if (record.hospital_institution_id !== requesterProfile.institution_id) {
            return NextResponse.json({ error: 'Forbidden: Anda hanya dapat mengupdate rekam medis dari institusi Anda' }, { status: 403 });
        }

        const data = await medicalRecordService.updateMedicalRecord(id, {
            notes: body.notes,
            patientId: record.patient_id,
        });

        return NextResponse.json({
            message: "Rekam medis berhasil diupdate",
            data
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
