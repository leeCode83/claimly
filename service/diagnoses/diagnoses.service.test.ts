import { DiagnosesService } from './diagnoses.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('DiagnosesService', () => {
    let service: DiagnosesService;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock chainable Supabase Client methods
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        service = new DiagnosesService(mockSupabase as unknown as SupabaseClient);
    });

    describe('createDiagnosis', () => {
        it('throws an error if icd10_code is missing', async () => {
            const payload = { icd10_code: '', description: 'Test Description' };
            await expect(service.createDiagnosis(payload)).rejects.toThrow('Parameter icd10_code dan description wajib diisi');
        });

        it('throws an error if description is missing', async () => {
            const payload = { icd10_code: 'A00.0', description: '' };
            await expect(service.createDiagnosis(payload)).rejects.toThrow('Parameter icd10_code dan description wajib diisi');
        });

        it('throws an error if icd10_code format is invalid', async () => {
            const payload = { icd10_code: 'INVALID_CODE', description: 'Test Description' };
            await expect(service.createDiagnosis(payload)).rejects.toThrow('Format icd10_code tidak valid (Contoh: K35, K35.1, M00.00)');
        });

        it('throws an error if Supabase query fails with error', async () => {
            const payload = { icd10_code: 'A00.0', description: 'Cholera' };
            mockSupabase.select.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });
            
            try {
                await service.createDiagnosis(payload);
            } catch (err: any) {
                expect(err.message).toBe('Database error');
                expect(err.status).toBe(400);
            }
        });

        it('returns data and encoded value on successful insertion', async () => {
            const payload = { icd10_code: 'A00.0', description: 'Cholera' };
            const mockData = [{ icd10_code: 'A00.0', icd10_integer_encoding: 1000001, description: 'Cholera' }];
            
            mockSupabase.select.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.createDiagnosis(payload);
             
            expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
            expect(mockSupabase.insert).toHaveBeenCalledWith({
                icd10_code: 'A00.0',
                icd10_integer_encoding: 1000001,
                description: 'Cholera'
            });
            expect(result.data).toEqual(mockData[0]);
            expect(result.encoded_value).toBe(1000001);
        });
    });

    describe('getDiagnoses', () => {
        it('throws a 500 error if Supabase query fails', async () => {
            mockSupabase.range.mockResolvedValueOnce({ data: null, error: { message: 'DB Error' }, count: null });
            
            try {
                await service.getDiagnoses();
            } catch (err: any) {
                expect(err.message).toBe('DB Error');
                expect(err.status).toBe(500);
            }
        });
        
        it('returns a list of diagnoses on success', async () => {
            const mockData = [{ icd10_code: 'A00.0', description: 'Cholera' }];
            mockSupabase.range.mockResolvedValueOnce({ data: mockData, error: null, count: 1 });

            const result = await service.getDiagnoses();
            
            expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
            expect(mockSupabase.select).toHaveBeenCalled();
            expect(mockSupabase.range).toHaveBeenCalledWith(0, 19);
            expect(result.data).toEqual(mockData);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 1,
                total_pages: 1
            });
        });
    });

    describe('getDiagnosisByIcd', () => {
        it('throws a 404 error if Supabase query fails or not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
            
            try {
                await service.getDiagnosisByIcd('A00.0');
            } catch(err: any) {
                 expect(err.message).toBe('Not found');
                 expect(err.status).toBe(404);
            }
        });

        it('returns exactly one diagnosis on success', async () => {
            const mockData = { icd10_code: 'A00.0', description: 'Cholera' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.getDiagnosisByIcd('A00.0');
            
            expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
            expect(mockSupabase.eq).toHaveBeenCalledWith('icd10_code', 'A00.0');
            expect(result).toEqual(mockData);
        });
    });

    describe('updateDiagnosisByIcd', () => {
        it('throws an error if payload is empty', async () => {
            await expect(service.updateDiagnosisByIcd('A00.0', {})).rejects.toThrow('Body request tidak boleh kosong untuk update');
            await expect(service.updateDiagnosisByIcd('A00.0', null)).rejects.toThrow('Body request tidak boleh kosong untuk update');
        });

        it('throws a 400 error if Supabase query fails', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });
            
            try {
               await service.updateDiagnosisByIcd('A00.0', { description: 'Updated Cholera' });
            } catch(err: any) {
               expect(err.message).toBe('Update failed');
               expect(err.status).toBe(400);
            }
        });

        it('returns the updated diagnosis on success', async () => {
            const payload = { description: 'Updated Cholera' };
            const mockData = { icd10_code: 'A00.0', description: 'Updated Cholera' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.updateDiagnosisByIcd('A00.0', payload);
            
            expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
            expect(mockSupabase.update).toHaveBeenCalledWith(payload);
            expect(mockSupabase.eq).toHaveBeenCalledWith('icd10_code', 'A00.0');
            expect(result).toEqual(mockData);
        });
    });

    describe('deleteDiagnosisByIcd', () => {
        it('throws a 400 error if Supabase delete fails', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Delete failed' } });
            
             try {
               await service.deleteDiagnosisByIcd('A00.0');
            } catch(err: any) {
               expect(err.message).toBe('Delete failed');
               expect(err.status).toBe(400);
            }
        });

        it('returns the deleted diagnosis on success', async () => {
            const mockData = { icd10_code: 'A00.0', description: 'Cholera' };
            mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

            const result = await service.deleteDiagnosisByIcd('A00.0');
            
            expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
            expect(mockSupabase.delete).toHaveBeenCalled();
            expect(mockSupabase.eq).toHaveBeenCalledWith('icd10_code', 'A00.0');
            expect(result).toEqual(mockData);
        });
    });

    describe('processBatchDiagnoses', () => {
        it('throws a 400 error if CSV is empty or has only headers', async () => {
            const csvText = "code;description";
            await expect(service.processBatchDiagnoses(csvText)).rejects.toThrow('File CSV kosong atau tidak memiliki data (minimal ada header dan 1 baris data)');
        });

        it('processes semicolon separated CSV properly', async () => {
             const csvText = "code;description\nA00.0;Cholera\nINVALID;Unknown";
             mockSupabase.upsert.mockResolvedValueOnce({ data: [], error: null });
             
             const result = await service.processBatchDiagnoses(csvText);
             
             expect(mockSupabase.from).toHaveBeenCalledWith('diagnoses');
             expect(mockSupabase.upsert).toHaveBeenCalledWith(
                 [{ icd10_code: "A00.0", icd10_integer_encoding: 1000001, description: "Cholera" }],
                 { onConflict: 'icd10_integer_encoding' }
             );
             
             expect(result.inserted_count).toBe(1);
             expect(result.invalid_count).toBe(1);
             expect(result.invalid_rows).toHaveLength(1);
             expect(result.invalid_rows[0].icd10_code).toBe('INVALID');
             expect(result.invalid_rows[0].reason).toBe('Format code tidak valid atau kosong');
        });

        it('processes comma separated CSV properly with quotes', async () => {
             const csvText = 'code,description\nA00.0,"Cholera, unspecified"\nB01.0,"Varicella component"';
             mockSupabase.upsert.mockResolvedValueOnce({ data: [], error: null });
             
             const result = await service.processBatchDiagnoses(csvText);
             
             expect(mockSupabase.upsert).toHaveBeenCalled();
             expect(result.inserted_count).toBe(2);
             expect(result.invalid_count).toBe(0);
        });

        it('throws a 400 error if no valid data is parsed to be inserted', async () => {
             const csvText = 'code,description\nINVALID,Unknown';
             try {
                 await service.processBatchDiagnoses(csvText);
             } catch(err: any) {
                 expect(err.message).toBe('Tidak ada data valid yang dapat diinsert');
                 expect(err.status).toBe(400);
                 expect(err.invalid_count).toBe(1);
             }
        });

        it('throws a 400 error if upsert fails on DB level', async () => {
             const csvText = 'code,description\nA00.0,Cholera';
             mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: { message: 'Upsert Error' } });
             
             try {
                 await service.processBatchDiagnoses(csvText);
             } catch(err: any) {
                 expect(err.message).toBe('Upsert Error');
                 expect(err.status).toBe(400);
             }
        });
    });
});
