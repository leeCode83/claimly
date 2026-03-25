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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { icd9_code, description, default_max_coverage } = body;

        // 1. Dapatkan Authenticated Client & User secara terpusat
        const { supabase, user, error: authError } = await getSupabaseServer(request);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Validasi parameter wajib
        if (!icd9_code || !description || !default_max_coverage) {
            return NextResponse.json(
                { error: "Parameter icd9_code, description, dan default_max_coverage wajib diisi" },
                { status: 400 }
            );
        }

        // Jalankan encoding logic
        const icd9_integer_encoding = encodeICD9(icd9_code);
        
        if (icd9_integer_encoding === null) {
            return NextResponse.json(
                { error: "Format icd9_code tidak valid" },
                { status: 400 }
            );
        }

        // Insert ke database (tabel procedures)
        const { data, error } = await supabase
            .from('procedures')
            .insert({ 
                icd9_code: icd9_code, 
                icd9_integer_encoding: icd9_integer_encoding, 
                description: description,
                default_max_coverage: default_max_coverage
            })
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: "Prosedur berhasil ditambahkan",
            data: data[0],
            encoded_value: icd9_integer_encoding 
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
        const { supabase, user, error: authError } = await getSupabaseServer(request);

        if(!user){
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('procedures')
            .select();

        if (data?.length == 0) {
            return NextResponse.json({ error: "Procedures data is empty" }, { status: 400 });
        }

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
