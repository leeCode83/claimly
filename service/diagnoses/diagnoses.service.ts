import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Logika Encoder ICD-10 telah diperbarui untuk mendukung multi-digit desimal:
 * Huruf pertama (A=1, B=2...) * 1000000
 * Dua digit berikutnya * 10000
 * Desimal didukung hingga panjang tak terhingga dan di-encode secara unik (1 digit +1, 2 digit +11, dst)
 */
function encodeICD10(code: string): number | null {
    const match = code.toUpperCase().match(/^([A-Z])(\d{2})(?:\.(\d+))?$/);
    if (!match) return null;

    const letter = match[1];
    const digits = parseInt(match[2], 10);
    const decStr = match[3];

    let decVal = 0;
    if (decStr !== undefined) {
        const parsedDec = parseInt(decStr, 10);
        if (decStr.length === 1) {
            decVal = parsedDec + 1;
        } else if (decStr.length === 2) {
            decVal = parsedDec + 11;
        } else if (decStr.length === 3) {
            decVal = parsedDec + 111;
        } else {
            decVal = parsedDec + 1111;
        }
    }

    const charPos = letter.charCodeAt(0) - 64; 
    return (charPos * 1000000) + (digits * 10000) + decVal;
}

export class DiagnosesService {
    constructor(private supabase: SupabaseClient) {}

    async createDiagnosis(payload: { icd10_code: string, description: string }) {
        if (!payload.icd10_code || !payload.description) {
            const err: any = new Error("Parameter icd10_code dan description wajib diisi");
            err.status = 400;
            throw err;
        }

        const icd10_integer_encoding = encodeICD10(payload.icd10_code);
        
        if (icd10_integer_encoding === null) {
            const err: any = new Error("Format icd10_code tidak valid (Contoh: K35, K35.1, M00.00)");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('diagnoses')
            .insert({ 
                icd10_code: payload.icd10_code, 
                icd10_integer_encoding: icd10_integer_encoding, 
                description: payload.description 
            })
            .select();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return {
            data: data[0],
            encoded_value: icd10_integer_encoding
        };
    }

    async getDiagnoses() {
        const { data, error } = await this.supabase
            .from('diagnoses')
            .select()
            .limit(20);

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }
        return data;
    }

    async getDiagnosisByIcd(icdCode: string) {
        const { data, error } = await this.supabase
            .from('diagnoses')
            .select()
            .eq('icd10_code', icdCode)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }
        return data;
    }

    async updateDiagnosisByIcd(icdCode: string, payload: any) {
        if (!payload || Object.keys(payload).length === 0) {
            const err: any = new Error("Body request tidak boleh kosong untuk update");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('diagnoses')
            .update(payload)
            .eq('icd10_code', icdCode)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async deleteDiagnosisByIcd(icdCode: string) {
        const { data, error } = await this.supabase
            .from('diagnoses')
            .delete()
            .eq('icd10_code', icdCode)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async processBatchDiagnoses(fileText: string) {
        const firstLineEnd = fileText.indexOf('\n');
        const firstLine = firstLineEnd !== -1 ? fileText.substring(0, firstLineEnd) : fileText;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        
        const rows = this.parseCSV(fileText, delimiter);

        if (rows.length < 2) {
            const err: any = new Error("File CSV kosong atau tidak memiliki data (minimal ada header dan 1 baris data)");
            err.status = 400;
            throw err;
        }

        let headCodeIdx = 0;
        let headDescIdx = 1;
        
        const header = rows[0].map(h => h.toLowerCase());
        const hasHeader = header.includes('code') || header.includes('description');
        
        if (hasHeader) {
            if (header.includes('code')) headCodeIdx = header.indexOf('code');
            if (header.includes('description')) headDescIdx = header.indexOf('description');
        }

        const validDataToInsert = [];
        const invalidRows = [];

        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const icd10_code = row[headCodeIdx];
            const description = row[headDescIdx];

            if (!icd10_code && !description) continue;

            const icd10_integer_encoding = encodeICD10(icd10_code || "");

            if (icd10_integer_encoding !== null) {
                validDataToInsert.push({
                    icd10_code,
                    icd10_integer_encoding,
                    description: description || ""
                });
            } else {
                invalidRows.push({ 
                    row: i + 1, 
                    icd10_code: icd10_code || "", 
                    description: description || "", 
                    reason: "Format code tidak valid atau kosong" 
                });
            }
        }

        if (validDataToInsert.length === 0) {
            const err: any = new Error("Tidak ada data valid yang dapat diinsert");
            err.status = 400;
            err.invalid_count = invalidRows.length;
            err.invalid_rows = invalidRows;
            throw err;
        }

        const { error } = await this.supabase
            .from('diagnoses')
            .upsert(validDataToInsert, { onConflict: 'icd10_integer_encoding' });

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return {
            inserted_count: validDataToInsert.length,
            invalid_count: invalidRows.length,
            invalid_rows: invalidRows
        };
    }

    private parseCSV(csvText: string, delimiter: string = ',') {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentCell += '"';
                    i++; 
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    currentCell += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === delimiter) {
                    currentRow.push(currentCell.trim());
                    currentCell = '';
                } else if (char === '\n' || char === '\r') {
                    if (char === '\r' && nextChar === '\n') {
                        i++; 
                    }
                    currentRow.push(currentCell.trim());
                    if (currentRow.some(cell => cell !== '')) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
        }
        
        if (currentCell !== '' || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell !== '')) {
                rows.push(currentRow);
            }
        }

        return rows;
    }
}
