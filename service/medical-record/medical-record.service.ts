import { SupabaseClient } from "@supabase/supabase-js";

function encodeDate(dateStr: string): number {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

export class MedicalRecordService {
    constructor(private supabase: SupabaseClient) {}

    async getMedicalRecords({ 
        hospitalInstitutionId, 
        patientId, 
        page = 1, 
        limit = 10,
        search,
        startDate,
        endDate
    }: {
        hospitalInstitutionId?: string,
        patientId?: string,
        page?: number,
        limit?: number,
        search?: string,
        startDate?: string,
        endDate?: string
    }) {
        let query = this.supabase
            .from('medical_records')
            .select(
                'id, patient_id, hospital_institution_id, diagnosis_id, diagnosis_date, created_at, notes_encrypted, institution:institutions!hospital_institution_id(id, name), diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role), claims:claims(id, status)',
                { count: 'exact' }
            );

        if (hospitalInstitutionId) {
            query = query.eq('hospital_institution_id', hospitalInstitutionId);
        }

        if (patientId) {
            query = query.eq('patient_id', patientId);
        }

        // Filter berdasarkan tanggal
        if (startDate) {
            query = query.gte('diagnosis_date', startDate);
        }
        if (endDate) {
            query = query.lte('diagnosis_date', endDate);
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

    async createMedicalRecord(payload: {
        patient_id: string,
        diagnosis_id: string,
        diagnosis_date: string,
        notes_encrypted?: string | null
    }, hospitalInstitutionId: string, attendingDoctorId: string) {
        if (!payload.patient_id || !payload.diagnosis_id || !payload.diagnosis_date) {
            const err: any = new Error("Parameter patient_id, diagnosis_id, dan diagnosis_date wajib diisi");
            err.status = 400;
            throw err;
        }

        const diagnosis_date_encoded = encodeDate(payload.diagnosis_date);

        const { data, error } = await this.supabase
            .from('medical_records')
            .insert({
                patient_id: payload.patient_id,
                hospital_institution_id: hospitalInstitutionId,
                diagnosis_id: payload.diagnosis_id,
                diagnosis_date: payload.diagnosis_date,
                diagnosis_date_encoded,
                attending_doctor_id: attendingDoctorId,
                notes_encrypted: payload.notes_encrypted || null
            })
            .select('*, diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role)')
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async getMedicalRecordById(id: string) {
        const { data, error } = await this.supabase
            .from('medical_records')
            .select('id, patient_id, hospital_institution_id, diagnosis_id, diagnosis_date, attending_doctor_id, notes_encrypted, created_at, institution:institutions!hospital_institution_id(id, name), diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role), claims:claims(id, status)')
            .eq('id', id)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }

        return data;
    }

    async updateMedicalRecord(id: string, payload: {
        notes_encrypted?: string | null
    }) {
        if (!payload || payload.notes_encrypted === undefined) {
            const err: any = new Error("Tidak ada field yang bisa diupdate");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('medical_records')
            .update({
                notes_encrypted: payload.notes_encrypted
            })
            .eq('id', id)
            .select('*, diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role)')
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }
}
