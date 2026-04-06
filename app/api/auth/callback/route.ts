import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Endpoint callback for OAuth Keycloak.
 * Handles the exchange of the authorization code for a session and
 * redirects the user to the appropriate dashboard based on their role.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 'next' is used as a fallback if the role-based redirection fails
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!, // Use 'key' consistent with existing config
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // This can be ignored if session refresh is handled in middleware
          }
        },
      },
    }
  )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const user = sessionData.user
      const role = user?.user_metadata?.custom_claims?.role || user?.user_metadata?.role

      let redirectPath = '/dashboard'
      if (role === 'hospital_staff') redirectPath = '/dashboard/hospital'
      else if (role === 'insurance_reviewer') redirectPath = '/dashboard/insurance'
      else if (role === 'patient') redirectPath = '/dashboard/patient'
      else if (role === 'admin') redirectPath = '/dashboard/admin'

      // console.log(`[AuthCallback] Final redirecting to: ${origin}${redirectPath}`);
      return NextResponse.redirect(`${origin}${redirectPath}`)
    } else {
      console.error('[AuthCallback Error]:', error.message)
    }
  }

  // Redirect to an error page if authentication fails
  // console.log(`[AuthCallback Request Failed] Redirecting back to: /auth/auth-code-error`);
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
