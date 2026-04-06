import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';
import { AuthService } from '@/service/auth/auth.service';

/**
 * API to initialize ZKP keypairs for the logged-in user.
 * Expects the client-side encrypted keybundle.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseServer(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const authService = new AuthService(supabase);
    
    const result = await authService.initializeZkpKeys(body);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error & { status?: number };
    console.error('[Init-ZKP API Error]:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
