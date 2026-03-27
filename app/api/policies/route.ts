import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PolicyService } from "@/service/policy/policy.service";

export async function GET(request: NextRequest){
    try {
        const {supabase, user, error: authError} = await getSupabaseServer(request);

        if(!user){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const policyService = new PolicyService(supabase);
        const data = await policyService.getPolicies();

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

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        
        const policyService = new PolicyService(supabase);
        const data = await policyService.createPolicy(user.id, body);

        return NextResponse.json({
            message: 'Policy created successfully',
            data: data
        }, { status: 201 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

