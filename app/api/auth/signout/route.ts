import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/supabase-config';
import { AuthService } from '@/service/auth/auth.service';

/**
 * Mengosongkan semua cookie Supabase yang ada di client.
 * Menggunakan pendekatan yang lebih luas untuk mencakup cookie chunked (@supabase/ssr).
 */
function clearAllAuthCookies(request: Request, response: NextResponse) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim().split('=')[0]);
    
    // Hapus semua cookie yang memiliki prefix supabase atau gotrue (standard & chunked)
    const authPrefixes = ['sb-', 'gotrue-', 'supabase-'];
    
    for (const cookieName of cookies) {
        if (authPrefixes.some(prefix => cookieName.startsWith(prefix))) {
            response.cookies.set(cookieName, '', {
                path: '/',
                expires: new Date(0),
                httpOnly: true,
                sameSite: 'lax'
            });
        }
    }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await getSupabaseServer(request);
    
    // Ambil session sebelum di-signout untuk mendapatkan provider hints
    const { data: { session } } = await supabase.auth.getSession();
    
    // 1. Invalidate session di sisi Supabase (Server-side)
    // Scope 'global' memastikan semua refresh token di-revoke
    const authService = new AuthService(supabase);
    const result = await authService.signOut();

    // 2. Siapkan URL Logout Keycloak (Front-channel)
    const keycloakBaseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Construct Keycloak Logout URL
    // client_id dan post_logout_redirect_uri wajib didaftarkan di Keycloak
    const logoutUrl = new URL(`${keycloakBaseUrl}/realms/claimly/protocol/openid-connect/logout`);
    logoutUrl.searchParams.append('client_id', 'claimly-supabase');
    logoutUrl.searchParams.append('post_logout_redirect_uri', `${appUrl}/auth?logout=true`);
    
    // Jika ada id_token (biasanya di provider_token jika dikonfigurasi), tambahkan hint 
    // agar Keycloak tidak menampilkan konfirmasi logout.
    if (session?.provider_token) {
        // Catatan: Keycloak End Session Endpoint mengharapkan id_token_hint, 
        // namun seringkali provider_token di Supabase adalah access_token.
        // logoutUrl.searchParams.append('id_token_hint', session.provider_token);
    }

    const response = NextResponse.json({ 
        ...result, 
        logoutUrl: logoutUrl.toString() 
    }, { status: 200 });
    
    // 3. Bersihkan sisa-sisa cookie di response
    clearAllAuthCookies(request, response);

    return response;
  } catch (err) {
    const error = err as Error & { status?: number };
    console.error('[SignOut Route] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

