import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import redis, { invalidateCache } from "@/lib/redis";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const id = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        
        // Authorization: hanya admin atau user yang bersangkutan
        if (role !== 'admin' && user.id !== id) {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const userService = new UserService(supabase);

        const cacheKey = `user:${id}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({ 
                data: JSON.parse(cachedData) 
            }, { status: 200 });
        }

        const data = await userService.getUserById(id);

        // Cache for 15 minutes
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 900);

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

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const id = params.id;
        
        const body = await request.json();

        const userService = new UserService(supabase);
        const data = await userService.updateUser(id, user.id, body);

        // Invalidate cache
        await invalidateCache('users');
        await redis.del(`user:${id}`);
        await redis.del(`user-me:${id}`);

        return NextResponse.json({ 
            message: "User berhasil diupdate",
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

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const id = params.id;

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        
        // Authorization: hanya admin atau user yang bersangkutan
        if (role !== 'admin' && user.id !== id) {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const userService = new UserService(supabase);
        const data = await userService.deleteUser(id);

        // Invalidate cache
        await invalidateCache('users');
        await redis.del(`user:${id}`);
        await redis.del(`user-me:${id}`);

        return NextResponse.json({ 
            message: "User berhasil dihapus",
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
