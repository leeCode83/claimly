import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { buildMerkleTree } from "@/service/zkp";

export async function GET(request: NextRequest){
    try {
        const {supabase, user, error: authError} = await getSupabaseServer(request);

        if(!user){
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('insurance_policies')
            .select()
            .limit(20)

        return NextResponse.json({
            message: `There are ${data?.length} in database`,
            data: data
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            policy_name,
            max_coverage_amount,
            valid_from,
            valid_until,
            diagnosis_codes,
            procedure_codes
        } = body;

        // Basic validation
        if (!policy_name || max_coverage_amount === undefined || !valid_from || !valid_until || 
            !Array.isArray(diagnosis_codes) || diagnosis_codes.length === 0 || 
            !Array.isArray(procedure_codes) || procedure_codes.length === 0) {
            return NextResponse.json({ error: 'Invalid payload or empty references' }, { status: 400 });
        }

        // Get user profile for institution_id
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('institution_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !userProfile || userProfile.role !== 'insurance_reviewer') {
            return NextResponse.json({ error: 'Forbidden: Only insurance reviewers can create policies' }, { status: 403 });
        }

        if (!userProfile.institution_id) {
            return NextResponse.json({ error: 'User does not belong to any institution' }, { status: 400 });
        }

        // Fetch encodings for diagnoses
        const uniqueDiagnosisCodes = [...new Set(diagnosis_codes)];
        const { data: diagnosesData, error: diagError } = await supabase
            .from('diagnoses')
            .select('id, icd10_integer_encoding, icd10_code')
            .in('icd10_code', uniqueDiagnosisCodes);

        if (diagError || !diagnosesData || diagnosesData.length !== uniqueDiagnosisCodes.length) {
            const foundCodes = diagnosesData?.map(d => d.icd10_code) || [];
            const missingCodes = uniqueDiagnosisCodes.filter(c => !foundCodes.includes(c as string));
            return NextResponse.json({ error: `Invalid diagnosis codes: ${missingCodes.join(', ')}` }, { status: 400 });
        }

        // Fetch encodings for procedures
        const uniqueProcedureCodes = [...new Set(procedure_codes)];
        const { data: proceduresData, error: procError } = await supabase
            .from('procedures')
            .select('id, icd9_integer_encoding, icd9_code')
            .in('icd9_code', uniqueProcedureCodes);

        if (procError || !proceduresData || proceduresData.length !== uniqueProcedureCodes.length) {
            const foundCodes = proceduresData?.map(p => p.icd9_code) || [];
            const missingCodes = uniqueProcedureCodes.filter(c => !foundCodes.includes(c as string));
            return NextResponse.json({ error: `Invalid procedure codes: ${missingCodes.join(', ')}` }, { status: 400 });
        }

        // Build Merkle Trees
        const diagnosisEncodings = diagnosesData.map(d => d.icd10_integer_encoding);
        const { root: diagRoot, leaves: diagLeaves } = await buildMerkleTree({ encodings: diagnosisEncodings });

        const procedureEncodings = proceduresData.map(p => p.icd9_integer_encoding);
        const { root: procRoot, leaves: procLeaves } = await buildMerkleTree({ encodings: procedureEncodings });

        // Insert policy
        const { data: policy, error: policyError } = await supabase
            .from('insurance_policies')
            .insert({
                insurance_institution_id: userProfile.institution_id,
                policy_name,
                max_coverage_amount,
                valid_from,
                valid_until,
                approved_diagnosis_root: diagRoot,
                approved_procedure_root: procRoot,
                is_active: true
            })
            .select('id')
            .single();

        if (policyError || !policy) {
            return NextResponse.json({ error: policyError?.message || 'Error creating policy' }, { status: 500 });
        }

        // Prepare junction table inserts
        const diagMap = Object.fromEntries(diagnosesData.map(d => [d.icd10_integer_encoding, d.id]));
        const pcdInserts = diagLeaves.map(leaf => ({
            policy_id: policy.id,
            diagnosis_id: diagMap[leaf.encoding],
            merkle_leaf_index: leaf.index,
            merkle_leaf_hash: leaf.hash
        }));

        const procMap = Object.fromEntries(proceduresData.map(p => [p.icd9_integer_encoding, p.id]));
        const pcpInserts = procLeaves.map(leaf => ({
            policy_id: policy.id,
            procedure_id: procMap[leaf.encoding],
            merkle_leaf_index: leaf.index,
            merkle_leaf_hash: leaf.hash
        }));

        // Insert junction tables
        if (pcdInserts.length > 0) {
            const { error: pcdError } = await supabase.from('policy_covered_diagnoses').insert(pcdInserts);
            if (pcdError) throw new Error(pcdError.message);
        }

        if (pcpInserts.length > 0) {
            const { error: pcpError } = await supabase.from('policy_covered_procedures').insert(pcpInserts);
            if (pcpError) throw new Error(pcpError.message);
        }

        return NextResponse.json({
            message: 'Policy created successfully',
            data: { id: policy.id }
        }, { status: 201 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

