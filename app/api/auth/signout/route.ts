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
    
    // Invalidate Keycloak SSO Session via Backchannel Logout if connected
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_refresh_token) {
        try {
            const formBody = new URLSearchParams();
            formBody.append("client_id", "claimly-supabase");
            formBody.append("refresh_token", session.provider_refresh_token);

            const keycloakBaseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080";
            await fetch(`${keycloakBaseUrl}/realms/claimly/protocol/openid-connect/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formBody.toString()
            });
            console.log('[SignOut Route] Successfully revoked Keycloak session.');
        } catch (kcErr) {
            console.error('[SignOut Route] Failed to revoke Keycloak session:', kcErr);
        }
    }

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
