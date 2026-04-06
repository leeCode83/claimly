import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';
import { AuthService } from '@/service/auth/auth.service';

/**
 * Endpoint for user sign out.
 * Destroys the session on the server side (Supabase).
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await getSupabaseServer(request);
    const authService = new AuthService(supabase);
    const result = await authService.signOut();

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error & { status?: number };
    console.error('[SignOut Route] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
