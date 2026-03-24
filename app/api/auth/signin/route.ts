import { NextResponse } from 'next/server';
import { supabase } from '@/supabase-config';

export async function POST(request: Request) {
  try {
    // Mengambil email dan password dari request body
    const body = await request.json();
    const { email, password } = body;

    // Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Melakukan sign in menggunakan Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Jika terjadi error dari Supabase (misal password salah)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Berhasil login
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    // Menangani error tak terduga
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
