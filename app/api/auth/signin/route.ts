import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';
import { AuthService } from '@/service/auth/auth.service';

export async function POST(request: Request) {
  try {
    const { supabase } = await getSupabaseServer(request);
    
    const authService = new AuthService(supabase);
    const data = await authService.getOAuthLoginUrl();

    // Data will contain { provider: 'keycloak', url: '...' }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const error = err as Error & { status?: number };
    console.error('[Sign-in OAuth API Error]:', error.message, 'Status:', error.status);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
