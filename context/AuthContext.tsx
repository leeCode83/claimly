"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { toast } from "sonner"
import { generateUserKeypairInBrowser } from "@/lib/crypto/browser-crypto"

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
<<<<<<< HEAD
  const [isLoading, setIsLoading] = useState(false)
=======
  const [isLoading, setIsLoading] = useState(true) // Start as loading to prevent premature redirects
  const usersApi = useUsers(accessToken)
>>>>>>> keycloak

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
          const userObj = {
            id: session.user.id,
            email: session.user.email || "",
            role: session.user.user_metadata?.custom_claims?.role || session.user.user_metadata?.role,
            full_name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.custom_claims?.given_name,
            institution_id: session.user.user_metadata?.custom_claims?.institution_id || session.user.user_metadata?.institution_id
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
          const userObj = {
            id: session.user.id,
            email: session.user.email || "",
            role: session.user.user_metadata?.custom_claims?.role || session.user.user_metadata?.role,
            full_name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.custom_claims?.given_name,
            institution_id: session.user.user_metadata?.custom_claims?.institution_id || session.user.user_metadata?.institution_id
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

<<<<<<< HEAD
      const authData = result.data.session;
      const token = authData?.access_token;
      
      if (token) {
        setAccessToken(token)
        localStorage.setItem("claimly_token", token)

        const rawUser = authData.user;
        const userData: User = {
          id: rawUser.id,
          email: rawUser.email,
          role: rawUser.user_metadata?.role,
          full_name: rawUser.user_metadata?.full_name,
          institution_id: rawUser.user_metadata?.institution_id,
        };
        
        setUser(userData)
        localStorage.setItem("claimly_user", JSON.stringify(userData))

        toast.success("Sign In Berhasil", {
          description: `Selamat datang kembali, ${userData.full_name || userData.email}!`,
        })

        return token
      }

      return null
=======
      if (result.data?.url) {
        window.location.href = result.data.url
      }
>>>>>>> keycloak
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

<<<<<<< HEAD
      const authData = result.data.session;
      const token = authData?.access_token;

      if (token) {
        setAccessToken(token)
        localStorage.setItem("claimly_token", token)

        const rawUser = authData.user;
        const userData: User = {
          id: rawUser.id,
          email: rawUser.email,
          role: rawUser.user_metadata?.role,
          full_name: rawUser.user_metadata?.full_name,
          institution_id: rawUser.user_metadata?.institution_id,
        };

        setUser(userData)
        localStorage.setItem("claimly_user", JSON.stringify(userData))
      }

      toast.success("Sign Up Berhasil", {
        description: "Akun Anda telah berhasil dibuat. Silakan cek email untuk verifikasi.",
      })

      return token || null
=======
      toast.success("Kunci Keamanan Berhasil Dibuat", {
        description: "Data Anda sekarang terlindungi sepenuhnya.",
      })
>>>>>>> keycloak
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
        await fetch("/api/auth/signout", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem("claimly_token");
        localStorage.removeItem("claimly_user");
        
        toast.success("Berhasil Keluar", {
            description: "Sesi Anda telah diakhiri secara menyeluruh."
        });

        window.location.href = "/auth";
    } catch (error) {
        console.error("[AuthContext.logoutLocal] Error:", error);
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
