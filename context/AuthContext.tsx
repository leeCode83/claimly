"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { toast } from "sonner"
import { generateUserKeypairInBrowser } from "@/lib/crypto/browser-crypto"
import { useUsers } from "@/hooks/useUsers"

interface User {
  id: string
  email: string
  role?: string
  full_name?: string
  institution_id?: string
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  signIn: () => Promise<void>
  signUp: () => Promise<void>
  logoutLocal: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start as loading to prevent premature redirects
  const usersApi = useUsers(accessToken)

  // Initialize from Supabase Session
  useEffect(() => {
    import('@supabase/ssr').then(({ createBrowserClient }) => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!
      )

      const refreshSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setAccessToken(session.access_token)
          const md = session.user.user_metadata;
          const userObj = {
            id: session.user.id,
            email: session.user.email || "",
            role: md?.custom_claims?.role || md?.role,
            full_name: md?.name || md?.full_name || md?.custom_claims?.given_name,
            institution_id: md?.custom_claims?.institution_id || md?.institution_id
          }
          setUser(userObj)
          // Keep localStorage for backward compatibility with other frontend components
          localStorage.setItem("claimly_token", session.access_token)
          localStorage.setItem("claimly_user", JSON.stringify(userObj))
        }
        setIsLoading(false) // Finish initial loading
      }

      refreshSession()

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setAccessToken(session.access_token)
          const md = session.user.user_metadata;
          const userObj = {
            id: session.user.id,
            email: session.user.email || "",
            role: md?.custom_claims?.role || md?.role,
            full_name: md?.name || md?.full_name || md?.custom_claims?.given_name,
            institution_id: md?.custom_claims?.institution_id || md?.institution_id
          }
          setUser(userObj)
          localStorage.setItem("claimly_token", session.access_token)
          localStorage.setItem("claimly_user", JSON.stringify(userObj))
        } else {
          setAccessToken(null)
          setUser(null)
          localStorage.removeItem("claimly_token")
          localStorage.removeItem("claimly_user")
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    })
  }, [])

  const signIn = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal mendapatkan URL Login")
      }

      if (result.data?.url) {
        window.location.href = result.data.url
      }
    } catch (error: any) {
      console.error("[AuthContext.signIn] Error:", error.message)
      toast.error("Otentikasi Gagal", { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async () => {
    // For OIDC, signup usually happens in the same IdP UI or a dedicated link
    // We redirect to the same Keycloak login which usually has a 'Register' link
    await signIn()
  }

  const initZkpKeys = async (pin: string) => {
    if (!accessToken) {
      toast.error("Error", { description: "User session not found" })
      return
    }

    setIsLoading(true)
    try {
      toast.info("Menyiapkan kunci keamanan...", {
        description: "Generasi kunci enkripsi dilakukan secara lokal di perangkat Anda.",
      })
      
      const bundle = await generateUserKeypairInBrowser(pin)
      
      const response = await fetch("/api/auth/init-zkp", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          p_public_key:           bundle.publicKeyB64,
          p_encrypted_priv_key:   bundle.encryptedPrivKeyB64,
          p_key_derivation_salt:  bundle.saltB64,
          p_key_iv:               bundle.ivB64,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Gagal menyimpan kunci keamanan.")
      }

      toast.success("Kunci Keamanan Berhasil Dibuat", {
        description: "Data Anda sekarang terlindungi sepenuhnya.",
      })
    } catch (error: any) {
      toast.error("Gagal inisialisasi kunci", { description: error.message })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logoutLocal = async () => {
    setIsLoading(true);
    try {
        const response = await fetch("/api/auth/signout", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        
        const result = await response.json();
        const logoutUrl = result.logoutUrl;
        
        // 1. Clear Context State
        setAccessToken(null);
        setUser(null);
        
        // 2. Clear LocalStorage
        localStorage.removeItem("claimly_token");
        localStorage.removeItem("claimly_user");
        
        // 3. Clear Cookies (Broad match for Supabase/Keycloak relative cookies)
        const cookiesList = document.cookie.split(';');
        for (const cookie of cookiesList) {
            const cookieName = cookie.split('=')[0].trim();
            const prefixes = ['sb-', 'gotrue-', 'supabase-'];
            if (prefixes.some(p => cookieName.startsWith(p))) {
                // Hapus cookie di root path
                document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                // Hapus cookie di current hostname domain
                document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
            }
        }

        // 4. Force Supabase Auth SignOut (Client-side)
        // Ini memastikan internal memory di browser-client benar-benar kosong.
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_KEY!
        );
        await supabase.auth.signOut();
        
        toast.success("Berhasil Keluar", {
            description: "Sesi Anda telah diakhiri secara menyeluruh."
        });

        // 5. Redirect ke Keycloak Logout (Front-channel)
        // Jika API tidak provide URL, fallback ke /auth
        if (logoutUrl) {
            window.location.href = logoutUrl;
        } else {
            window.location.href = "/auth";
        }
    } catch (error) {
        console.error("[AuthContext.logoutLocal] Error:", error);
        toast.error("Gagal Logout", { description: "Terjadi kesalahan sistem." });
        setIsLoading(false);
    }
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        signIn,
        signUp,
        logoutLocal
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}
