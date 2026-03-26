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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { icd10_code, description } = body;

        // 1. Dapatkan Authenticated Client & User secara terpusat
        const { supabase, user, error: authError } = await getSupabaseServer(request);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validasi parameter wajib
        if (!icd10_code || !description) {
            return NextResponse.json(
                { error: "Parameter icd10_code dan description wajib diisi" },
                { status: 400 }
            );
        }

        // Jalankan encoding logic
        const icd10_integer_encoding = encodeICD10(icd10_code);
        
        if (icd10_integer_encoding === null) {
            return NextResponse.json(
                { error: "Format icd10_code tidak valid (Contoh: K35, K35.1, M00.00)" },
                { status: 400 }
            );
        }

        // Insert ke database (menggunakan nama kolom yang sesuai di skema: icd10_integer_encoding)
        const { data, error } = await supabase
            .from('diagnoses')
            .insert({ 
                icd10_code: icd10_code, 
                icd10_integer_encoding: icd10_integer_encoding, 
                description: description 
            })
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: "Diagnosa berhasil ditambahkan",
            data: data[0],
            encoded_value: icd10_integer_encoding 
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest){
    try {
        const {supabase, user, error: authError} = await getSupabaseServer(request);

        if(!user){
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('diagnoses')
            .select()

        return NextResponse.json({
            message: `There are ${data?.length} in database`,
            data: data
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}