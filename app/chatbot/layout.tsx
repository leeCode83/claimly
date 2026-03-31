"use client"

import { useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/AuthContext"
import { Loader2Icon } from "lucide-react"

export default function ChatbotLayout({ children }: { children: ReactNode }) {
  const { user, accessToken, isLoading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!accessToken) {
      router.push("/auth")
    } else if (user?.role !== "patient") {
      // Redirect staff/admin to their dashboard
      const rolePath = user?.role === 'hospital_staff' ? 'hospital' : 
                      user?.role === 'insurance_reviewer' ? 'insurance' : 
                      user?.role || 'patient'
      router.push(`/dashboard/${rolePath}`)
    }
  }, [accessToken, user, isLoading, router])

  if (isLoading || !accessToken || user?.role !== "patient") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
