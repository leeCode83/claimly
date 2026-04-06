import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";

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
        const data = await userService.getUserById(id);

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

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);
        
        // Authorization: update role atau institution_id hanya Admin
        if (role !== 'admin') {
             return NextResponse.json({ error: 'Forbidden: Admin access only for updating users' }, { status: 403 });
        }

        const userService = new UserService(supabase);
        const data = await userService.updateUser(id, body);

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
