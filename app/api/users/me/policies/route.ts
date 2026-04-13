import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { PatientService } from "@/service/patient/patient.service";
import redis from "@/lib/redis";

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role);

        if (role !== 'patient') {
            return NextResponse.json({ error: 'Forbidden: Hanya pasien yang dapat melihat daftar polis asuransi mereka sendiri' }, { status: 403 });
        }

        const patientService = new PatientService(supabase);

        const cacheKey = `user-me-policies:${user.id}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return NextResponse.json({
                message: "Berhasil mengambil daftar polis asuransi Anda",
                data: JSON.parse(cachedData)
            }, { status: 200 });
        }

        const data = await patientService.getPatientPoliciesByUserId(user.id);

        // Cache for 15 minutes
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 900);

        return NextResponse.json({
            message: "Berhasil mengambil daftar polis asuransi Anda",
            data
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
    }
}
