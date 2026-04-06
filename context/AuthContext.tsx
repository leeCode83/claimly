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
  initZkpKeys: (pin: string) => Promise<void>
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

  const logoutLocal = () => {
    setAccessToken(null)
    setUser(null)
    localStorage.removeItem("claimly_token")
    localStorage.removeItem("claimly_user")
    toast.success("Logged out successfully")
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signUp, initZkpKeys, logoutLocal }}>
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
