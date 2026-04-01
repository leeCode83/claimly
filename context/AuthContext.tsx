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
  signIn: (payload: { email?: string; password?: string }) => Promise<string | null>
  signUp: (payload: { email?: string; password?: string; full_name?: string; role?: string; institution_id?: string }) => Promise<string | null>
  logoutLocal: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const usersApi = useUsers(accessToken)

  // Initialize from localStorage if available
  useEffect(() => {
    const storedToken = localStorage.getItem("claimly_token")
    const storedUser = localStorage.getItem("claimly_user")
    if (storedToken && storedUser) {
      setAccessToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const signIn = async (payload: { email?: string; password?: string }) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        const message = result.error || "Gagal masuk. Silakan cek kembali email dan password Anda."
        toast.error("Sign In Gagal", { description: message })
        throw new Error(message)
      }

      const token = result.data.session?.access_token
      setAccessToken(token)
      localStorage.setItem("claimly_token", token)

      // Use the hook's getMe function with token override
      const userData: User = await usersApi.getMe(token)
      
      setUser(userData)
      localStorage.setItem("claimly_user", JSON.stringify(userData))

      toast.success("Sign In Berhasil", {
        description: `Selamat datang kembali, ${userData.full_name || userData.email}!`,
      })

      return token
    } catch (error: any) {
      console.error("[AuthContext.signIn] Error:", error.message)
      if (error.message === "Failed to fetch") {
        toast.error("Masalah Jaringan", { description: "Tidak dapat terhubung ke server." })
      }
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (payload: {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
    institution_id?: string;
  }) => {
    setIsLoading(true)
    try {
      let signupPayload: any = { ...payload }

      if (payload.password) {
        toast.info("Menyiapkan kunci keamanan...", {
          description: "Generasi kunci enkripsi dilakukan secara lokal di perangkat Anda.",
        })
        
        const bundle = await generateUserKeypairInBrowser(payload.password)
        
        signupPayload = {
          ...signupPayload,
          p_public_key:           bundle.publicKeyB64,
          p_encrypted_priv_key:   bundle.encryptedPrivKeyB64,
          p_key_derivation_salt:  bundle.saltB64,
          p_key_iv:               bundle.ivB64,
        }
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupPayload),
      })

      const result = await response.json()

      if (!response.ok) {
        const message = result.error || "Gagal mendaftar. Silakan coba lagi."
        toast.error("Sign Up Gagal", { description: message })
        throw new Error(message)
      }

      toast.success("Sign Up Berhasil", {
        description: "Akun Anda telah berhasil dibuat. Silakan cek email untuk verifikasi.",
      })

      return result.data.session?.access_token || null
    } catch (error: any) {
      if (error.message === "Failed to fetch") {
        toast.error("Masalah Jaringan", { description: "Tidak dapat terhubung ke server." })
      }
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logoutLocal = () => {
    setAccessToken(null)
    setUser(null)
    localStorage.removeItem("claimly_token")
    localStorage.removeItem("claimly_user")
    toast.success("Logged out successfully")
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signUp, logoutLocal }}>
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
