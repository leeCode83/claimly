import { MedicalRecordService } from './medical-record.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { encryptNoteForPatient } from '@/lib/crypto/note-crypto';

// Mock crypto library
jest.mock('@/lib/crypto/note-crypto', () => ({
    encryptNoteForPatient: jest.fn()
}));

describe('MedicalRecordService', () => {
    let service: MedicalRecordService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock chainable Supabase Client methods
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        };

        service = new MedicalRecordService(mockSupabase as unknown as SupabaseClient);
    });

    describe('getMedicalRecords', () => {
        const hospitalId = 'hosp-1';

        it('throws a 500 error if Supabase query fails', async () => {
            mockSupabase.order.mockResolvedValueOnce({ data: null, count: 0, error: { message: 'Fetch error' } });
            
            try {
                await service.getMedicalRecords({ hospitalInstitutionId: hospitalId });
            } catch (err: any) {
                expect(err.message).toBe('Fetch error');
                expect(err.status).toBe(500);
            }
        });

        it('returns medical records with pagination and metadata', async () => {
            const mockData = [{ id: 'mr-1', notes_encrypted: 'abc' }];
            mockSupabase.order.mockResolvedValueOnce({ data: mockData, count: 50, error: null });

            const result = await service.getMedicalRecords({ 
                hospitalInstitutionId: hospitalId,
                page: 2,
                limit: 10
            });

            expect(mockSupabase.from).toHaveBeenCalledWith('medical_records');
            expect(mockSupabase.select).toHaveBeenCalled();
            expect(mockSupabase.eq).toHaveBeenCalledWith('hospital_institution_id', hospitalId);
            expect(mockSupabase.range).toHaveBeenCalledWith(10, 19); // Page 2, 10-19
            expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });

            expect(result.data).toEqual(mockData);
            expect(result.meta.total).toBe(50);
            expect(result.meta.page).toBe(2);
            expect(result.meta.total_pages).toBe(5);
        });

        it('applies patient_id filter if provided', async () => {
            const patientId = 'patient-123';
            mockSupabase.order.mockResolvedValueOnce({ data: [], count: 0, error: null });

            await service.getMedicalRecords({ 
                hospitalInstitutionId: hospitalId,
                patientId
            });

            expect(mockSupabase.eq).toHaveBeenCalledWith('patient_id', patientId);
        });
    });

    describe('createMedicalRecord', () => {
        const payload = {
            patient_id: 'p-1',
            diagnosis_id: 'd-1',
            diagnosis_date: '2024-03-28',
            notes: 'Test Note'
        };
        const hospitalId = 'hosp-1';
        const doctorId = 'doc-1';

        it('throws 400 if required parameters are missing', async () => {
            await expect(service.createMedicalRecord({} as any, hospitalId, doctorId))
                .rejects.toThrow('Parameter patient_id, diagnosis_id, dan diagnosis_date wajib diisi');
        });

        it('encrypts notes if public key is available', async () => {
            // Mock RPC success
            mockSupabase.rpc.mockResolvedValueOnce({ data: 'fake-public-key', error: null });
            // Mock crypto success
            (encryptNoteForPatient as jest.Mock).mockReturnValueOnce('encrypted-blob');
            // Mock insert success
            const mockResult = { id: 'new-mr', notes_encrypted: 'encrypted-blob' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockResult, error: null });

            const result = await service.createMedicalRecord(payload, hospitalId, doctorId);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('get_patient_public_key', { p_patient_id: payload.patient_id });
            expect(encryptNoteForPatient).toHaveBeenCalledWith('fake-public-key', payload.notes);
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                notes_encrypted: 'encrypted-blob',
                diagnosis_date_encoded: 20240328
            }));
            expect(result).toEqual(mockResult);
        });

        it('saves null notes_encrypted if public key fails/missing', async () => {
            // Mock RPC returns null (no keypair)
            mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.single.mockResolvedValueOnce({ data: { id: 'mr-no-enc' }, error: null });

            await service.createMedicalRecord(payload, hospitalId, doctorId);

            expect(encryptNoteForPatient).not.toHaveBeenCalled();
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                notes_encrypted: null
            }));
        });

        it('throws 400 on database error', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

            try {
                await service.createMedicalRecord(payload, hospitalId, doctorId);
            } catch (err: any) {
                expect(err.message).toBe('Insert failed');
                expect(err.status).toBe(400);
            }
        });
    });

    describe('getMedicalRecordById', () => {
        it('returns record on success', async () => {
            const mockData = { id: 'mr-1', notes_encrypted: 'abc' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.getMedicalRecordById('mr-1');

            expect(mockSupabase.from).toHaveBeenCalledWith('medical_records');
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'mr-1');
            expect(result).toEqual(mockData);
        });

        it('throws 404 if record not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

            try {
                await service.getMedicalRecordById('invalid-id');
            } catch (err: any) {
                expect(err.message).toBe('Not found');
                expect(err.status).toBe(404);
            }
        });
    });

    describe('updateMedicalRecord', () => {
        const id = 'mr-1';

        it('throws 400 if payload invalid', async () => {
            await expect(service.updateMedicalRecord(id, {} as any))
                .rejects.toThrow('Tidak ada field yang bisa diupdate');
            await expect(service.updateMedicalRecord(id, { notes: undefined }))
                .rejects.toThrow('Tidak ada field yang bisa diupdate');
        });

        it('updates with encrypted notes if patientId provided', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: 'pub-key', error: null });
            (encryptNoteForPatient as jest.Mock).mockReturnValueOnce('new-encrypted');
            mockSupabase.single.mockResolvedValueOnce({ data: { id, notes_encrypted: 'new-encrypted' }, error: null });

            const result = await service.updateMedicalRecord(id, { 
                notes: 'New text', 
                patientId: 'p-1' 
            });

            expect(encryptNoteForPatient).toHaveBeenCalledWith('pub-key', 'New text');
            expect(mockSupabase.update).toHaveBeenCalledWith({ notes_encrypted: 'new-encrypted' });
            expect(result.notes_encrypted).toBe('new-encrypted');
        });

        it('clears notes if empty string provided', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { id, notes_encrypted: null }, error: null });

            await service.updateMedicalRecord(id, { 
                notes: '', 
                patientId: 'p-1' 
            });

            expect(mockSupabase.update).toHaveBeenCalledWith({ notes_encrypted: null });
        });

        it('throws 400 on database error', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Update error' } });

            try {
                await service.updateMedicalRecord(id, { notes: 'abc', patientId: 'p1' });
            } catch (err: any) {
                expect(err.message).toBe('Update error');
                expect(err.status).toBe(400);
            }
        });
    });
});
