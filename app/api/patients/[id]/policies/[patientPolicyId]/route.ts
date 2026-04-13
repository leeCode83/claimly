import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PolicyService } from "@/service/policy/policy.service";
import { PatientService } from "@/service/patient/patient.service";
import { invalidateCache } from "@/lib/redis";
import { extractUserProfile, checkPatientAccess } from "@/lib/api-auth";
import { Patient } from "@/types/auth";

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string, patientPolicyId: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;
        const patientPolicyId = params.patientPolicyId;
        const body = await request.json();

        const patientService = new PatientService(supabase);
        const policyService = new PolicyService(supabase);
        const requesterProfile = extractUserProfile(user);

        const patient = await patientService.getPatientById(id);

        const accessError = await checkPatientAccess(user.id, requesterProfile, patient as unknown as Patient);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        const data = await policyService.updatePolicy(patientPolicyId, body);

        // Invalidate cache
        await invalidateCache('policies');

        return NextResponse.json({
            message: "Data asuransi pasien berhasil diupdate",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string, patientPolicyId: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = await props.params;
        const id = params.id;
        const patientPolicyId = params.patientPolicyId;

        const patientService = new PatientService(supabase);
        const policyService = new PolicyService(supabase);
        const requesterProfile = extractUserProfile(user);

        const patient = await patientService.getPatientById(id);

        const accessError = await checkPatientAccess(user.id, requesterProfile, patient as unknown as Patient);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        await policyService.deletePolicy(patientPolicyId);

        // Invalidate cache
        await invalidateCache('policies');

        return NextResponse.json({
            message: "Data asuransi pasien berhasil dihapus"
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
