import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';
import { AuthService } from '@/service/auth/auth.service';

export async function POST(request: Request) {
  try {
    const { supabase } = await getSupabaseServer(request);
    const body = await request.json();

    const authService = new AuthService(supabase);
    const data = await authService.signIn(body);

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    );
  }
}
