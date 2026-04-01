"use client"

import { useEffect, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthContext } from "@/context/AuthContext"
import { Loader2Icon, ShieldAlertIcon } from "lucide-react"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, accessToken, isLoading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth")
    }
  }, [accessToken, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!accessToken) {
    return null
  }

  // Optional: Role check for sub-routes
  // e.g. if pathname.includes('/admin') and user.role !== 'admin' ... redirect

  return <div className="animate-in fade-in duration-500">{children}</div>
}
