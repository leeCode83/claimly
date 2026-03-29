import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { UserService } from "@/service/user/user.service";
import { AuditLogService } from "@/service/audit-log/audit-log.service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ entityType: string; entityId: string }> }
) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userService = new UserService(supabase);
        const requesterProfile = await userService.getMe(user.id);

        const allowedRoles = ['admin', 'insurance_reviewer'];
        if (!allowedRoles.includes(requesterProfile.role)) {
            return NextResponse.json(
                { error: 'Forbidden: Hanya admin atau insurance_reviewer yang dapat mengakses audit logs entitas' },
                { status: 403 }
            );
        }

        const params = await props.params;
        const { entityType, entityId } = params;

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const auditLogService = new AuditLogService(supabase);
        const result = await auditLogService.getAuditLogsByEntity(entityType, entityId, { page, limit });

        return NextResponse.json({
            message: `Berhasil mengambil audit log untuk ${entityType} dengan id ${entityId}`,
            ...result,
        }, { status: 200 });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}

