import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/supabase-config";

/**
 * GET /api/users/me/crypto-data
 *
 * Mengembalikan data kriptografi milik user yang sedang login.
 * Digunakan oleh browser pasien untuk mendekripsi private key
 * menggunakan password yang diinput user.
 *
 * Tidak mengembalikan private key dalam bentuk plaintext —
 * hanya encrypted_priv_key yang harus di-decrypt di browser.
 *
 * Auth: Bearer token diperlukan (user harus login)
 * Role: Hanya patient yang relevan (tapi semua role bisa akses milik sendiri)
 */
export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await getSupabaseServer(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Panggil RPC get_my_crypto_data() — dikunci ke auth.uid()
        // Hanya bisa mengambil data milik user sendiri
        const { data, error } = await supabase.rpc('get_my_crypto_data');

        if (error) {
            return NextResponse.json(
                { error: 'Gagal mengambil data kriptografi: ' + error.message },
                { status: 500 }
            );
        }

        if (!data || data.length === 0 || !data[0]?.encrypted_priv_key) {
            return NextResponse.json(
                { error: 'Keypair belum tersedia. Pastikan akun Anda terdaftar dengan benar.' },
                { status: 404 }
            );
        }

        const { encrypted_priv_key, key_derivation_salt, key_iv } = data[0];

        return NextResponse.json({
            message: 'Data kriptografi berhasil diambil',
            data: {
                encrypted_priv_key,   // private key terenkripsi (aman dikirim — butuh password untuk buka)
                key_derivation_salt,  // salt untuk PBKDF2 derivation di browser
                key_iv,               // IV untuk AES-GCM decrypt di browser
            }
        }, { status: 200 });

    } catch (err) {
        const error = err as Error & { status?: number };
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.status || 500 }
        );
    }
}
