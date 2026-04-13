import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  if (error) {
    console.error('[AuthCallback] OAuth Error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
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

    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.error('[AuthCallback] Session Error:', sessionError.message)
      return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(sessionError.message)}`)
    }

    const user = sessionData.user
    const role = user?.user_metadata?.custom_claims?.role || user?.user_metadata?.role

    let redirectPath = '/dashboard'
    if (role === 'hospital_staff') redirectPath = '/dashboard/hospital'
    else if (role === 'insurance_reviewer') redirectPath = '/dashboard/insurance'
    else if (role === 'patient') redirectPath = '/dashboard/patient'
    else if (role === 'admin') redirectPath = '/dashboard/admin'

    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  return NextResponse.redirect(`${origin}/auth?error=No+authorization+code+received`)
}
