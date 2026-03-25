import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

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

        const { data, error } = await supabase
            .from('procedures')
            .select()
            .eq('icd9_code', icdCode)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
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

        if (!body || Object.keys(body).length === 0) {
            return NextResponse.json(
                { error: "Body request tidak boleh kosong untuk update" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('procedures')
            .update(body)
            .eq('icd9_code', icdCode)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: "Prosedur berhasil diupdate",
            data 
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
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

        const { data, error } = await supabase
            .from('procedures')
            .delete()
            .eq('icd9_code', icdCode)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: "Prosedur berhasil dihapus",
            data 
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
