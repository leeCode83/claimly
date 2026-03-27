import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ProceduresService } from "@/service/procedures/procedures.service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);

        const proceduresService = new ProceduresService(supabase);
        const data = await proceduresService.getProcedureByIcd(icdCode);

        return NextResponse.json({ data }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);
        
        const body = await request.json();

        const proceduresService = new ProceduresService(supabase);
        const data = await proceduresService.updateProcedureByIcd(icdCode, body);

        return NextResponse.json({ 
            message: "Prosedur berhasil diupdate",
            data 
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ icd: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const icdCode = decodeURIComponent(params.icd);

        const proceduresService = new ProceduresService(supabase);
        const data = await proceduresService.deleteProcedureByIcd(icdCode);

        return NextResponse.json({ 
            message: "Prosedur berhasil dihapus",
            data 
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}
