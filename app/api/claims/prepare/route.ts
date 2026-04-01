import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ClaimService } from "@/service/claim/claim.service";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const searchParams = request.nextUrl.searchParams;
        const patient_policy_id = searchParams.get('patient_policy_id');
        const medical_record_id = searchParams.get('medical_record_id');
        const procedure_id = searchParams.get('procedure_id');
        const procedure_date = searchParams.get('procedure_date');
        const claim_amount_str = searchParams.get('claim_amount');

        if (!patient_policy_id || !medical_record_id || !procedure_id || !procedure_date || !claim_amount_str) {
            return NextResponse.json({ 
                error: 'Query parameters are missing: patient_policy_id, medical_record_id, procedure_id, procedure_date, claim_amount' 
            }, { status: 400 });
        }

        const claim_amount = parseFloat(claim_amount_str);
        if (isNaN(claim_amount)) {
            return NextResponse.json({ error: 'Invalid claim_amount' }, { status: 400 });
        }

        const claimService = new ClaimService(supabase);
        const zkpInput = await claimService.getZKPPreparationData({
            patient_policy_id,
            medical_record_id,
            procedure_id,
            procedure_date,
            claim_amount
        });

        return NextResponse.json({
            message: "Berhasil mengambil data persiapan ZKP",
            data: zkpInput
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 });
    }
}
