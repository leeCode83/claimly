import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";
import { ProceduresService } from "@/service/procedures/procedures.service";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        
        let file: File | null = formData.get('file') as File | null;
        
        if (!file) {
            for (const value of formData.values()) {
                if (value instanceof Blob) {
                    file = value as File;
                    break;
                }
            }
        }

        if (!file) {
            return NextResponse.json(
                { error: "File CSV tidak ditemukan pada request form-data. Pastikan untuk upload file dengan key 'file' di Body form-data." },
                { status: 400 }
            );
        }

        const fallbackCoverageStr = formData.get('default_max_coverage') as string | null;
        const fallbackCoverage = fallbackCoverageStr ? parseFloat(fallbackCoverageStr) : null;

        const fileText = await file.text();

        const { supabase, user } = await getSupabaseServer(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const proceduresService = new ProceduresService(supabase);
        const result = await proceduresService.processBatchProcedures(fileText, fallbackCoverage);

        return NextResponse.json({ 
            message: `Berhasil menambahkan ${result.inserted_count} prosedur secara batch`,
            ...result
        }, { status: 201 });

    } catch (err: any) {
        if (err.invalid_rows) {
            return NextResponse.json(
                { 
                    error: err.message || 'Error occurred', 
                    invalid_count: err.invalid_count,
                    invalid_rows: err.invalid_rows 
                },
                { status: err.status || 400 }
            );
        }

        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.status || 500 }
        );
    }
}
