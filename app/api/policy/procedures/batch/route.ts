import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

/**
 * Logika Encoder ICD-9 (Diformulasi agar semua varian unik):
 * Mengubah format string ICD-9 menjadi integer unik agar tidak ada duplikasi ID.
 * - String desimal dipetakan ke angka unik berdasarkan panjangnya untuk mencegah bentrok
 *   seperti "0" vs "00.0" maupun "00.1" vs "00.10".
 */
function encodeICD9(code: string): number | null {
    if (!code) return null;
    
    // Pattern ini akan mengenali alphanumeric di awal, opsional ditutup titik dan angka di akhir
    const match = code.trim().toUpperCase().match(/^([A-Z]*\d+)(?:\.(\d+))?$/);
    if (!match) return null;

    const baseStr = match[1];
    let baseInt = 0;
    
    // Support jika ada V-code atau E-code huruf di awal String
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
    
    // Mapping desimal untuk menjamin keunikan string numerik
    if (decStr !== undefined) {
        const parsedDec = parseInt(decStr, 10);
        if (decStr.length === 1) {
            decVal = parsedDec + 1;         // "0"->"9"    => 1->10
        } else if (decStr.length === 2) {
            decVal = parsedDec + 11;        // "00"->"99"  => 11->110
        } else if (decStr.length === 3) {
            decVal = parsedDec + 111;       // "000"->"999"=> 111->1110
        } else {
            decVal = parsedDec + 1111;      // Fallback
        }
    }
    
    return (baseInt * 10000) + decVal;
}

// Fungsi sederhana untuk parsing CSV yang mendukung quotes
function parseCSV(csvText: string, delimiter: string = ',') {
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
                i++; // Skip escaped quote
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
                    i++; // Skip \n for \r\n
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
    
    // Tambahkan cell/row yang tersisa di akhir file
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow);
        }
    }

    return rows;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        
        let file: File | null = formData.get('file') as File | null;
        
        // Coba cari file di semua key jika key 'file' tidak ditemukan
        if (!file) {
            for (const value of formData.values()) {
                if (value instanceof Blob) {
                    file = value as File;
                    break;
                }
            }
        }

        if (!file) {
            return NextResponse.json(
                { error: "File CSV tidak ditemukan pada request form-data. Pastikan untuk upload file dengan key 'file' di Body form-data." },
                { status: 400 }
            );
        }

        // Lihat apakah ada `default_max_coverage` yang diberikan secara global (melalui input text Form-Data)
        // Hal ini berguna jika CSV / icd9.csv tidak memiliki kolom default_max_coverage.
        const fallbackCoverageStr = formData.get('default_max_coverage') as string | null;
        const fallbackCoverage = fallbackCoverageStr ? parseFloat(fallbackCoverageStr) : null;

        const fileText = await file.text();
        
        // Deteksi delimiter (koma atau titik koma) berdasarkan baris pertama
        const firstLineEnd = fileText.indexOf('\n');
        const firstLine = firstLineEnd !== -1 ? fileText.substring(0, firstLineEnd) : fileText;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        
        const rows = parseCSV(fileText, delimiter);

        if (rows.length < 2) {
            return NextResponse.json(
                { error: "File CSV kosong atau tidak memiliki data (minimal ada header dan 1 baris data)" },
                { status: 400 }
            );
        }

        // Default index untuk code dan description
        let headCodeIdx = 0;
        let headDescIdx = 1;
        let headCoverageIdx = -1; // -1 jika tidak ditemukan kolom coverage di CSV
        
        const header = rows[0].map(h => h.toLowerCase());
        const hasHeader = header.includes('code') || header.includes('description');
        
        if (hasHeader) {
            if (header.includes('code')) headCodeIdx = header.indexOf('code');
            if (header.includes('description')) headDescIdx = header.indexOf('description');
            
            // Kolom Max Coverage pada CSV mungkin bernama 'default_max_coverage' atau 'max_coverage' atau 'coverage'
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

        // Jika ada header, mulai dari baris 1 (indeks 1), jika tidak dari indeks 0
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const icd9_code = row[headCodeIdx];
            const description = row[headDescIdx];
            
            // Coba ambil max coverage dari row ini, jika -1 maka fallback ke data Form Global
            const rowCoverageStr = headCoverageIdx !== -1 ? row[headCoverageIdx] : null;
            let finalCoverage: number | null = null;
            
            if (rowCoverageStr && rowCoverageStr.trim() !== '') {
                finalCoverage = parseFloat(rowCoverageStr);
            } else if (fallbackCoverage !== null) {
                finalCoverage = fallbackCoverage;
            }

            // Abaikan baris kosong
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
            return NextResponse.json({ 
                error: "Tidak ada data valid yang dapat diinsert", 
                invalid_count: invalidRows.length,
                invalid_rows: invalidRows 
            }, { status: 400 });
        }

        const { supabase, user, error: authError } = await getSupabaseServer(request);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Bulk upsert ke tabel procedures
        const { error } = await supabase
            .from('procedures')
            .upsert(validDataToInsert, { onConflict: 'icd9_integer_encoding' }); // Gunakan tipe upsert demi menghindari duplicate index crash

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: `Berhasil menambahkan ${validDataToInsert.length} prosedur secara batch`,
            inserted_count: validDataToInsert.length,
            invalid_count: invalidRows.length,
            invalid_rows: invalidRows
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
