import { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { poseidonHashArray } from "../zkp/poseidon";

function hashNIK(nik: string): string {
    return createHash('sha256').update(nik).digest('hex');
}

function stringToFieldElement(str: string): bigint {
    // Map string to a field element (BN254 prime field roughly 2^254)
    // We use SHA256 hash first and then convert to BigInt to handle strings of any length
    const hash = createHash('sha256').update(str).digest('hex');
    return BigInt('0x' + hash) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
}

async function generatePolicyCommitment(
    patientId: string,
    policyId: string,
    policyNumber: string,
    startDate: string
): Promise<string> {
    const inputs = [
        stringToFieldElement(patientId),
        stringToFieldElement(policyId),
        stringToFieldElement(policyNumber),
        stringToFieldElement(startDate)
    ];
    return poseidonHashArray(inputs);
}

export class PatientService {
    constructor(private supabase: SupabaseClient) {}

    async getPatients({ hospitalId, page = 1, limit = 10, search = '' }: { hospitalId: string, page?: number, limit?: number, search?: string }) {
        let query = this.supabase
            .from('patients')
            .select('id, full_name, gender, birth_year, created_at, user:user_id(public_key)', { count: 'exact' })
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
            .select('*, user:user_id(public_key), patient_policies(*, insurance_policies:policy_id(*))')
            .eq('id', id)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = error.code === 'PGRST116' ? 404 : 500;
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

    async getPatientPolicies(
        patientId: string,
        { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
    ) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await this.supabase
            .from('patient_policies')
            .select('*, insurance_policies:policy_id(*)', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        return {
            data,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                total_pages: Math.ceil((count ?? 0) / limit),
            },
        };
    }

    async getPatientPolicyById(patientId: string, patientPolicyId: string) {
        const { data, error } = await this.supabase
            .from('patient_policies')
            .select('*, insurance_policies:policy_id(id, policy_name, valid_from, valid_until, is_active)')
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

    async getPatientPoliciesByUserId(userId: string) {
        // 1. Get patient record
        const { data: patient, error: patientError } = await this.supabase
            .from('patients')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            const err: any = new Error('Patient record not found for this user');
            err.status = 404;
            throw err;
        }

        // 2. Get active policies for this patient
        const { data, error } = await this.supabase
            .from('patient_policies')
            .select(`
                *,
                insurance_policy:insurance_policies(
                    *,
                    insurance_institution:institutions(id, name)
                )
            `)
            .eq('patient_id', patient.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
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
        const policy_commitment = await generatePolicyCommitment(
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
            .select('*, insurance_policies:policy_id(*)')
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }
}
