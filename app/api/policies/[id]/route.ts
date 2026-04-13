import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PolicyService } from "@/service/policy/policy.service";
import redis, { invalidateCache } from "@/lib/redis";
import { authorizeApiRequest } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['admin', 'hospital_staff', 'insurance_reviewer', 'patient'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const id = params.id;

        const cacheKey = `policy:${id}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({ 
                data: JSON.parse(cachedData) 
            }, { status: 200 });
        }

        const policyService = new PolicyService(supabase);
        const data = await policyService.getPolicyById(id);

        // Cache for 1 hour
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);

        return NextResponse.json({ data }, { status: 200 });
    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['insurance_reviewer'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const id = params.id;
        const body = await request.json();

        const policyService = new PolicyService(supabase);
        const data = await policyService.updatePolicy(id, body);

        // Invalidate cache
        await invalidateCache('policies');
        await redis.del(`policy:${id}`);

        return NextResponse.json({ 
            message: "Policy successfully updated",
            data 
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { errorResponse } = authorizeApiRequest(user, { 
            allowedRoles: ['admin', 'insurance_reviewer'],
            requireInstitution: true
        });
        if (errorResponse) return errorResponse;

        const params = await props.params;
        const id = params.id;

        const policyService = new PolicyService(supabase);
        const data = await policyService.deletePolicy(id);

        // Invalidate cache
        await invalidateCache('policies');
        await redis.del(`policy:${id}`);

        return NextResponse.json({ 
            message: "Policy successfully deleted",
            data 
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
