import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Logika Encoder ICD-9 (Diformulasi agar semua varian unik):
 * Mengubah format string ICD-9 menjadi integer unik agar tidak ada duplikasi ID.
 * - String desimal dipetakan ke angka unik berdasarkan panjangnya untuk mencegah bentrok
 *   seperti "0" vs "00.0" maupun "00.1" vs "00.10".
 */
function encodeICD9(code: string): number | null {
    if (!code) return null;
    
    const match = code.trim().toUpperCase().match(/^([A-Z]*\d+)(?:\.(\d+))?$/);
    if (!match) return null;

    const baseStr = match[1];
    let baseInt = 0;
    
    const letterMatch = baseStr.match(/^([A-Z]+)(\d+)$/);
    if (letterMatch) {
        let charVal = 0;
        for (let i = 0; i < letterMatch[1].length; i++) {
            charVal = charVal * 26 + (letterMatch[1].charCodeAt(i) - 64);
        }
        const digits = parseInt(letterMatch[2], 10);
        baseInt = (charVal * 100000) + digits;
    } else {
        baseInt = parseInt(baseStr, 10);
    }

    const decStr = match[2];
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
    
    return (baseInt * 10000) + decVal;
}

export class ProceduresService {
    constructor(private supabase: SupabaseClient) {}

    async createProcedure(payload: { icd9_code: string, description: string, default_max_coverage: number }) {
        if (!payload.icd9_code || !payload.description || payload.default_max_coverage === undefined) {
            const err: any = new Error("Parameter icd9_code, description, dan default_max_coverage wajib diisi");
            err.status = 400;
            throw err;
        }

        const icd9_integer_encoding = encodeICD9(payload.icd9_code);
        
        if (icd9_integer_encoding === null) {
            const err: any = new Error("Format icd9_code tidak valid");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('procedures')
            .insert({ 
                icd9_code: payload.icd9_code, 
                icd9_integer_encoding: icd9_integer_encoding, 
                description: payload.description,
                default_max_coverage: payload.default_max_coverage
            })
            .select();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return {
            data: data[0],
            encoded_value: icd9_integer_encoding 
        };
    }

    async getProcedures() {
        const { data, error } = await this.supabase
            .from('procedures')
            .select()
            .limit(20);

        if (error) {
            const err: any = new Error(error.message);
            err.status = 500;
            throw err;
        }

        if (data?.length === 0) {
            const err: any = new Error("Procedures data is empty");
            err.status = 400;
            throw err;
        }

        return data;
    }

    async getProcedureByIcd(icdCode: string) {
        const { data, error } = await this.supabase
            .from('procedures')
            .select()
            .eq('icd9_code', icdCode)
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 404;
            throw err;
        }
        return data;
    }

    async updateProcedureByIcd(icdCode: string, payload: any) {
        if (!payload || Object.keys(payload).length === 0) {
            const err: any = new Error("Body request tidak boleh kosong untuk update");
            err.status = 400;
            throw err;
        }

        const { data, error } = await this.supabase
            .from('procedures')
            .update(payload)
            .eq('icd9_code', icdCode)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async deleteProcedureByIcd(icdCode: string) {
        const { data, error } = await this.supabase
            .from('procedures')
            .delete()
            .eq('icd9_code', icdCode)
            .select()
            .single();

        if (error) {
            const err: any = new Error(error.message);
            err.status = 400;
            throw err;
        }

        return data;
    }

    async processBatchProcedures(fileText: string, fallbackCoverage: number | null) {
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
        let headCoverageIdx = -1;
        
        const header = rows[0].map(h => h.toLowerCase());
        const hasHeader = header.includes('code') || header.includes('description');
        
        if (hasHeader) {
            if (header.includes('code')) headCodeIdx = header.indexOf('code');
            if (header.includes('description')) headDescIdx = header.indexOf('description');
            
            if (header.includes('default_max_coverage')) {
                headCoverageIdx = header.indexOf('default_max_coverage');
            } else if (header.includes('max_coverage')) {
                headCoverageIdx = header.indexOf('max_coverage');
            } else if (header.includes('coverage')) {
                headCoverageIdx = header.indexOf('coverage');
            }
        }

        const validDataToInsert = [];
        const invalidRows = [];

        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const icd9_code = row[headCodeIdx];
            const description = row[headDescIdx];
            
            const rowCoverageStr = headCoverageIdx !== -1 ? row[headCoverageIdx] : null;
            let finalCoverage: number | null = null;
            
            if (rowCoverageStr && rowCoverageStr.trim() !== '') {
                finalCoverage = parseFloat(rowCoverageStr);
            } else if (fallbackCoverage !== null) {
                finalCoverage = fallbackCoverage;
            }

            if (!icd9_code && !description) continue;
            
            if (finalCoverage === null || isNaN(finalCoverage)) {
                 invalidRows.push({ 
                    row: i + 1, 
                    icd9_code: icd9_code || "", 
                    description: description || "", 
                    reason: "default_max_coverage wajib diisi (Tambahkan kolom ke CSV atau isi key Form-Data default_max_coverage)" 
                });
                continue;
            }

            const icd9_integer_encoding = encodeICD9(icd9_code || "");

            if (icd9_integer_encoding !== null) {
                validDataToInsert.push({
                    icd9_code,
                    icd9_integer_encoding,
                    description: description || "",
                    default_max_coverage: finalCoverage
                });
            } else {
                invalidRows.push({ 
                    row: i + 1, 
                    icd9_code: icd9_code || "", 
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
            .from('procedures')
            .upsert(validDataToInsert, { onConflict: 'icd9_integer_encoding' });

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
