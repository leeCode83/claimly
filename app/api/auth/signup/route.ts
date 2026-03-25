import { NextResponse, NextRequest } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';

export async function POST(request: NextRequest) {
  try {
    // Inisialisasi Supabase client (akan otomatis mendaftar sebagai anonim jika belum login)
    const { supabase } = await getSupabaseServer(request);

    // Mengambil email dan password dari request body
    const body = await request.json();
    const { email, password, full_name, role, institution_id } = body;

    // Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Melakukan sign up menggunakan Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
            full_name,
            role,
            institution_id
        }
      }
    });

    // Jika terjadi error dari Supabase (misal email sudah terdaftar atau password kurang kuat)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Berhasil register/signup
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    // Menangani error tak terduga
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
