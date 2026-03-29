import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { DiagnosesService } from "@/service/diagnoses/diagnoses.service";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Dapatkan Authenticated Client & User secara terpusat
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const diagnosesService = new DiagnosesService(supabase);
        const result = await diagnosesService.createDiagnosis(body);

        return NextResponse.json({ 
            message: "Diagnosa berhasil ditambahkan",
            data: result.data,
            encoded_value: result.encoded_value 
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

export async function GET(request: NextRequest){
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if(!user){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const diagnosesService = new DiagnosesService(supabase);
        const result = await diagnosesService.getDiagnoses({ page, limit });

        return NextResponse.json({
            message: `Berhasil mengambil daftar diagnosa`,
            ...result
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}