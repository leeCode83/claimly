import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

/**
 * Logika Encoder ICD-10 sesuai spesifikasi:
 * Huruf pertama (A=1, B=2...) * 10000
 * Dua digit berikutnya * 100
 * Jika tidak ada desimal: + 0
 * Jika ada desimal: + (digit desimal + 1)
 */
function encodeICD10(code: string): number | null {
    const match = code.toUpperCase().match(/^([A-Z])(\d{2})(\.(\d))?$/);
    if (!match) return null;

    const letter = match[1];
    const digits = parseInt(match[2]);
    const hasDecimal = match[3] !== undefined;
    const decimal = hasDecimal ? parseInt(match[4]) : 0;

    const charPos = letter.charCodeAt(0) - 64; // A=65, maka 65-64=1
    return (charPos * 10000) + (digits * 100) + (hasDecimal ? (decimal + 1) : 0);
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
                { error: "Format icd10_code tidak valid (Contoh: K35, K35.1, A01.0)" },
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