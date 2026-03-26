import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('institutions')
            .select()
            .limit(20);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({
            message: `There are ${data?.length || 0} in database`,
            data: data
        }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, type, license_number, address, is_active } = body;

        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!name || !type || !license_number) {
            return NextResponse.json(
                { error: "Parameters name, type, and license_number are required" },
                { status: 400 }
            );
        }
        
        if (type !== 'hospital' && type !== 'insurance') {
             return NextResponse.json(
                { error: "type must be either 'hospital' or 'insurance'" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('institutions')
            .insert({ 
                name, 
                type, 
                license_number, 
                address: address || null,
                is_active: is_active !== undefined ? is_active : true
            })
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            message: "Institution successfully added",
            data: data[0]
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
