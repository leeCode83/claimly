import { SupabaseClient } from "@supabase/supabase-js";
import { encryptNoteForPatient } from "@/lib/crypto/note-crypto";

function encodeDate(dateStr: string): number {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

/**
 * Mengenkripsi catatan dokter menggunakan public key pasien.
 * Jika pasien belum punya keypair (baru terdaftar, belum aktivasi akun),
 * kembalikan null — notes tidak akan dienkripsi.
 *
 * @param supabase   Supabase client dengan auth token dokter
 * @param patientId  UUID pasien
 * @param notes      Catatan plaintext dari dokter
 * @returns          Ciphertext JSON string, atau null jika public key tidak tersedia
 */
async function encryptNotesIfPossible(
    supabase: SupabaseClient,
    patientId: string,
    notes: string
): Promise<string | null> {
    // Ambil public key pasien via RPC yang sudah ada di migration
    const { data: publicKeyB64, error } = await supabase
        .rpc('get_patient_public_key', { p_patient_id: patientId });

    if (error) {
        console.error('[encryptNotesIfPossible] Gagal fetch public key:', error.message);
        return null;
    }

    if (!publicKeyB64) {
        // Pasien belum punya keypair (baru signup belum activate, atau bukan patient role)
        // Simpan null — frontend dokter bisa tampilkan warning "Catatan tidak bisa dienkripsi"
        console.warn(`[encryptNotesIfPossible] Pasien ${patientId} belum memiliki public key`);
        return null;
    }

    // Enkripsi catatan menggunakan public key pasien
    return encryptNoteForPatient(publicKeyB64, notes);
}

export class MedicalRecordService {
    constructor(private supabase: SupabaseClient) {}

    async getMedicalRecords({ hospitalInstitutionId, patientId, page = 1, limit = 10 }: {
        hospitalInstitutionId?: string,
        patientId?: string,
        page?: number,
        limit?: number
    }) {
        let query = this.supabase
            .from('medical_records')
            .select(
                '*, diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role)',
                { count: 'exact' }
            );

        if (hospitalInstitutionId) {
            query = query.eq('hospital_institution_id', hospitalInstitutionId);
        }

        query = query.limit(20);

        if (patientId) {
            query = query.eq('patient_id', patientId);
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
        notes?: string
    }, hospitalInstitutionId: string, attendingDoctorId: string) {
        if (!payload.patient_id || !payload.diagnosis_id || !payload.diagnosis_date) {
            const err: any = new Error("Parameter patient_id, diagnosis_id, dan diagnosis_date wajib diisi");
            err.status = 400;
            throw err;
        }

        const diagnosis_date_encoded = encodeDate(payload.diagnosis_date);

        // Enkripsi notes jika disediakan
        let notes_encrypted: string | null = null;
        if (payload.notes && payload.notes.trim().length > 0) {
            notes_encrypted = await encryptNotesIfPossible(
                this.supabase,
                payload.patient_id,
                payload.notes
            );
            // notes_encrypted bisa null jika pasien belum punya keypair
            // Ini masih oke — record tetap dibuat, notes hanya tidak terenkripsi
        }

        const { data, error } = await this.supabase
            .from('medical_records')
            .insert({
                patient_id: payload.patient_id,
                hospital_institution_id: hospitalInstitutionId,
                diagnosis_id: payload.diagnosis_id,
                diagnosis_date: payload.diagnosis_date,
                diagnosis_date_encoded,
                attending_doctor_id: attendingDoctorId,
                notes_encrypted
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
            .select('*, diagnosis:diagnoses(icd10_code, description), patient:patients(id, full_name), attending_doctor:users!attending_doctor_id(id, full_name, role)')
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
        notes?: string,
        patientId?: string
    }) {
        if (!payload || payload.notes === undefined) {
            const err: any = new Error("Tidak ada field yang bisa diupdate");
            err.status = 400;
            throw err;
        }

        // Enkripsi notes baru jika ada dan patientId tersedia
        let notes_encrypted: string | null | undefined = undefined;
        if (payload.notes !== undefined && payload.patientId) {
            if (payload.notes.trim().length === 0) {
                notes_encrypted = null;  // hapus notes
            } else {
                notes_encrypted = await encryptNotesIfPossible(
                    this.supabase,
                    payload.patientId,
                    payload.notes
                );
            }
        }

        const updatePayload: Record<string, any> = {};
        if (notes_encrypted !== undefined) {
            updatePayload.notes_encrypted = notes_encrypted;
        }

        if (Object.keys(updatePayload).length === 0) {
            const err: any = new Error("Tidak ada field yang bisa diupdate");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('medical_records')
            .update(updatePayload)
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
