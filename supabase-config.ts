import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Helper untuk mendapatkan Supabase Client yang sudah terautentikasi.
 * Sekarang mendukung otentikasi berbasis Bearer token (API) maupun Cookie (OAuth/SSR).
 * Menggunakan @supabase/ssr sesuai rekomendasi untuk Next.js App Router.
 */
export async function getSupabaseServer(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      global: authHeader?.toLowerCase().startsWith('bearer ')
        ? { headers: { Authorization: `Bearer ${authHeader.replace(/^Bearer\s+/i, '').trim()}` } }
        : {},
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
            // Standard Next.js server cookie handling
          }
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error }
  }

  return { supabase, user, error: null }
}