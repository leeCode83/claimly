import { SupabaseClient } from "@supabase/supabase-js";
import { buildMerkleTree } from "@/service/zkp";

export class PolicyService {
    constructor(private supabase: SupabaseClient) {}

    async getPolicies(limit: number = 20) {
        const { data, error } = await this.supabase
            .from('insurance_policies')
            .select()
            .limit(limit);

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }
        return data;
    }

    async getPolicyById(id: string) {
        const { data, error } = await this.supabase
            .from('insurance_policies')
            .select()
            .eq('id', id)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }
        return data;
    }

    async createPolicy(userId: string, payload: any) {
        const {
            policy_name,
            max_coverage_amount,
            valid_from,
            valid_until,
            diagnosis_codes,
            procedure_codes
        } = payload;

        // Basic validation
        if (!policy_name || max_coverage_amount === undefined || !valid_from || !valid_until || 
            !Array.isArray(diagnosis_codes) || diagnosis_codes.length === 0 || 
            !Array.isArray(procedure_codes) || procedure_codes.length === 0) {
            const err: any = new Error('Invalid payload or empty references');
            err.status = 400;
            throw err;
        }

        // Get user profile for institution_id
        const { data: userProfile, error: profileError } = await this.supabase
            .from('users')
            .select('institution_id, role')
            .eq('id', userId)
            .single();

        if (profileError || !userProfile || userProfile.role !== 'insurance_reviewer') {
            const err: any = new Error('Forbidden: Only insurance reviewers can create policies');
            err.status = 403;
            throw err;
        }

        if (!userProfile.institution_id) {
            const err: any = new Error('User does not belong to any institution');
            err.status = 400;
            throw err;
        }

        // Fetch encodings for diagnoses
        const uniqueDiagnosisCodes = [...new Set(diagnosis_codes)];
        const { data: diagnosesData, error: diagError } = await this.supabase
            .from('diagnoses')
            .select('id, icd10_integer_encoding, icd10_code')
            .in('icd10_code', uniqueDiagnosisCodes);

        if (diagError || !diagnosesData || diagnosesData.length !== uniqueDiagnosisCodes.length) {
            const foundCodes = diagnosesData?.map(d => d.icd10_code) || [];
            const missingCodes = uniqueDiagnosisCodes.filter(c => !foundCodes.includes(c as string));
            const err: any = new Error(`Invalid diagnosis codes: ${missingCodes.join(', ')}`);
            err.status = 400;
            throw err;
        }

        // Fetch encodings for procedures
        const uniqueProcedureCodes = [...new Set(procedure_codes)];
        const { data: proceduresData, error: procError } = await this.supabase
            .from('procedures')
            .select('id, icd9_integer_encoding, icd9_code')
            .in('icd9_code', uniqueProcedureCodes);

        if (procError || !proceduresData || proceduresData.length !== uniqueProcedureCodes.length) {
            const foundCodes = proceduresData?.map(p => p.icd9_code) || [];
            const missingCodes = uniqueProcedureCodes.filter(c => !foundCodes.includes(c as string));
            const err: any = new Error(`Invalid procedure codes: ${missingCodes.join(', ')}`);
            err.status = 400;
            throw err;
        }

        // Build Merkle Trees
        const diagnosisEncodings = diagnosesData.map(d => d.icd10_integer_encoding);
        const { root: diagRoot, leaves: diagLeaves } = await buildMerkleTree({ encodings: diagnosisEncodings });

        const procedureEncodings = proceduresData.map(p => p.icd9_integer_encoding);
        const { root: procRoot, leaves: procLeaves } = await buildMerkleTree({ encodings: procedureEncodings });

        // Insert policy
        const { data: policy, error: policyError } = await this.supabase
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
            const err: any = new Error(policyError?.message || 'Error creating policy');
            err.status = 500;
            throw err;
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
            const { error: pcdError } = await this.supabase.from('policy_covered_diagnoses').insert(pcdInserts);
            if (pcdError) throw new Error(pcdError.message);
        }

        if (pcpInserts.length > 0) {
            const { error: pcpError } = await this.supabase.from('policy_covered_procedures').insert(pcpInserts);
            if (pcpError) throw new Error(pcpError.message);
        }

        return { id: policy.id };
    }

    async updatePolicy(id: string, updateData: any) {
        if (!updateData || Object.keys(updateData).length === 0) {
            const err: any = new Error("Request body cannot be empty for update");
            err.status = 400;
            throw err;
        }

        // Standard updatable fields
        const allowedFields = ['policy_name', 'max_coverage_amount', 'valid_from', 'valid_until', 'is_active'];
        const filteredData: Record<string, any> = {};
        for (const key of Object.keys(updateData)) {
            if (allowedFields.includes(key)) {
                filteredData[key] = updateData[key];
            }
        }

        if (Object.keys(filteredData).length === 0) {
            const err: any = new Error("No valid fields to update");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('insurance_policies')
            .update(filteredData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }
        return data;
    }

    async deletePolicy(id: string) {
        const { data, error } = await this.supabase
            .from('insurance_policies')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }
        return data;
    }
}
