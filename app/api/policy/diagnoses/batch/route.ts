import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

/**
 * Logika Encoder ICD-10 telah diperbarui untuk mendukung multi-digit desimal:
 * Huruf pertama (A=1, B=2...) * 1000000
 * Dua digit berikutnya * 10000
 * Desimal didukung hingga panjang tak terhingga dan di-encode secara unik (1 digit +1, 2 digit +11, dst)
 */
function encodeICD10(code: string): number | null {
    // Regex diperbarui untuk mendukung lebih dari 1 digit setelah titik (contoh: M00.00)
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

    const charPos = letter.charCodeAt(0) - 64; // A=65, maka 65-64=1
    // Pengali dibesarkan menjadi 1.000.000 agar nilai desimal yang bisa mencapai > 100 tidak bentrok dengan nilai `digits * 100`
    return (charPos * 1000000) + (digits * 10000) + decVal;
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
        
        const header = rows[0].map(h => h.toLowerCase());
        const hasHeader = header.includes('code') || header.includes('description');
        
        if (hasHeader) {
            if (header.includes('code')) headCodeIdx = header.indexOf('code');
            if (header.includes('description')) headDescIdx = header.indexOf('description');
        }

        const validDataToInsert = [];
        const invalidRows = [];

        // Jika ada header, mulai dari baris 1 (indeks 1), jika tidak dari indeks 0
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const icd10_code = row[headCodeIdx];
            const description = row[headDescIdx];

            // Abaikan baris kosong
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
            return NextResponse.json({ 
                error: "Tidak ada data valid yang dapat diinsert", 
                invalid_count: invalidRows.length,
                invalid_rows: invalidRows 
            }, { status: 400 });
        }

        const { supabase,user, error: authError } = await getSupabaseServer(request);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Bulk upsert ke tabel diagnoses
        // Gunakan upsert dengan opsi onConflict field icd10_integer_encoding
        // Ini memastikan jika user mengulang proses yang sama, data hanya akan di-update tidak menjadi conflict error
        const { error } = await supabase
            .from('diagnoses')
            .upsert(validDataToInsert, { onConflict: 'icd10_integer_encoding' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: `Berhasil menambahkan ${validDataToInsert.length} diagnosa secara batch`,
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
