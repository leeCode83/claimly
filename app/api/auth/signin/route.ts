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
  } catch (err) {
    const error = err as Error & { status?: number };
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
