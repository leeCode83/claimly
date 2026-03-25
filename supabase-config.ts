import { createServerClient } from '@supabase/ssr'

/**
 * Helper untuk mendapatkan Supabase Client yang sudah terautentikasi
 * berdasarkan Bearer token dari Authorization header.
 * Menggunakan @supabase/ssr sesuai rekomendasi untuk Next.js App Router.
 */
export async function getSupabaseServer(request: Request) {
  const authHeader = request.headers.get('Authorization')

  // Buat client tanpa autentikasi (fallback)
  const makeClient = (token?: string) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        global: token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {},
        cookies: {
          // Stub cookie handler — tidak dipakai karena kita pakai Bearer token,
          // tapi wajib ada agar createServerClient tidak throw error
          getAll: () => [],
          setAll: () => {},
        },
      }
    )

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { supabase: makeClient(), user: null, error: null }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const supabase = makeClient(token)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error }
  }

  return { supabase, user, error: null }
}