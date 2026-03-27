import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ProceduresService } from "@/service/procedures/procedures.service";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Dapatkan Authenticated Client & User secara terpusat
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const proceduresService = new ProceduresService(supabase);
        const result = await proceduresService.createProcedure(body);

        return NextResponse.json({ 
            message: "Prosedur berhasil ditambahkan",
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

        const proceduresService = new ProceduresService(supabase);
        const data = await proceduresService.getProcedures();

        return NextResponse.json({
            message: `There are ${data?.length} in database`,
            data: data
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}
