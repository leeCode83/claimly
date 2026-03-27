import { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function hashNIK(nik: string): string {
    return createHash('sha256').update(nik).digest('hex');
}

function generatePolicyCommitment(
    patientId: string,
    policyId: string,
    policyNumber: string,
    startDate: string
): string {
    return createHash('sha256')
        .update(`${patientId}${policyId}${policyNumber}${startDate}`)
        .digest('hex');
}

export class PatientService {
    constructor(private supabase: SupabaseClient) {}

    async getPatients({ hospitalId, page = 1, limit = 10, search = '' }: { hospitalId: string, page?: number, limit?: number, search?: string }) {
        let query = this.supabase
            .from('patients')
            .select('*', { count: 'exact' })
            .eq('hospital_id', hospitalId);

        if (search) {
            query = query.ilike('full_name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to).order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        return {
            data,
            meta: {
                total: count || 0,
                page,
                limit,
                total_pages: Math.ceil((count || 0) / limit)
            }
        };
    }

    async createPatient(payload: {
        nik: string,
        full_name: string,
        birth_year: number,
        gender: 'M' | 'F',
        user_id?: string | null
    }, registeredBy: string, hospitalId: string) {
        if (!payload.nik || !payload.full_name || !payload.birth_year || !payload.gender) {
            const err: any = new Error("Parameter nik, full_name, birth_year, dan gender wajib diisi");
            err.status = 400;
            throw err;
        }

        const nik_hash = hashNIK(payload.nik);

        const { data, error } = await this.supabase
            .from('patients')
            .insert({
                nik_hash,
                full_name: payload.full_name,
                birth_year: payload.birth_year,
                gender: payload.gender,
                user_id: payload.user_id || null,
                registered_by: registeredBy,
                hospital_id: hospitalId
            })
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async getPatientById(id: string) {
        const { data, error } = await this.supabase
            .from('patients')
            .select('*, patient_policies(*, insurance_policies(*))')
            .eq('id', id)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }

        return data;
    }

    async updatePatient(id: string, payload: { full_name?: string, birth_year?: number, gender?: string }) {
        if (!payload || Object.keys(payload).length === 0) {
            const err: any = new Error("Body request tidak boleh kosong untuk update");
            err.status = 400;
            throw err;
        }

        const allowedFields = ['full_name', 'birth_year', 'gender'];
        const updateData: any = {};
        for (const key of allowedFields) {
            if ((payload as any)[key] !== undefined) {
                updateData[key] = (payload as any)[key];
            }
        }

        const { data, error } = await this.supabase
            .from('patients')
            .update(updateData)
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

    async getPatientPolicies(patientId: string) {
        const { data, error } = await this.supabase
            .from('patient_policies')
            .select('*, insurance_policies(*)')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        return data;
    }

    async getPatientPolicyById(patientId: string, patientPolicyId: string) {
        const { data, error } = await this.supabase
            .from('patient_policies')
            .select('*, insurance_policies(*)')
            .eq('id', patientPolicyId)
            .eq('patient_id', patientId)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }

        return data;
    }

    async createPatientPolicy(patientId: string, payload: {
        policy_id: string,
        policy_number: string,
        start_date: string,
        end_date: string
    }) {
        // 1. Validasi field wajib
        if (!payload.policy_id || !payload.policy_number || !payload.start_date || !payload.end_date) {
            const err: any = new Error("Parameter policy_id, policy_number, start_date, dan end_date wajib diisi");
            err.status = 400;
            throw err;
        }

        if (new Date(payload.start_date) >= new Date(payload.end_date)) {
            const err: any = new Error("start_date harus lebih awal dari end_date");
            err.status = 400;
            throw err;
        }

        // 2. Verifikasi insurance_policy exist dan aktif
        const { data: insurancePolicy, error: policyError } = await this.supabase
            .from('insurance_policies')
            .select('id, is_active')
            .eq('id', payload.policy_id)
            .single();

        if (policyError || !insurancePolicy) {
            const err: any = new Error(`Polis asuransi dengan id '${payload.policy_id}' tidak ditemukan`);
            err.status = 404;
            throw err;
        }

        if (!insurancePolicy.is_active) {
            const err: any = new Error("Polis asuransi ini sudah tidak aktif dan tidak bisa digunakan");
            err.status = 400;
            throw err;
        }

        // 3. Cek apakah pasien sudah punya polis aktif
        const { data: existingActive } = await this.supabase
            .from('patient_policies')
            .select('id')
            .eq('patient_id', patientId)
            .eq('is_active', true)
            .maybeSingle();

        if (existingActive) {
            const err: any = new Error("Pasien sudah memiliki polis aktif. Nonaktifkan polis yang lama terlebih dahulu");
            err.status = 409;
            throw err;
        }

        // 4. Generate policy_commitment di backend — JANGAN dari input user
        const policy_commitment = generatePolicyCommitment(
            patientId,
            payload.policy_id,
            payload.policy_number,
            payload.start_date
        );

        // 5. Insert ke patient_policies
        const { data, error } = await this.supabase
            .from('patient_policies')
            .insert({
                patient_id: patientId,
                policy_id: payload.policy_id,
                policy_number: payload.policy_number,
                policy_commitment,
                start_date: payload.start_date,
                end_date: payload.end_date,
                is_active: true
            })
            .select('*, insurance_policies(*)')
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }
}
