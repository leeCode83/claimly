"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/AuthContext"
import { Loader2Icon, ShieldCheckIcon } from "lucide-react"

export default function Home() {
  const { user, accessToken, isLoading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!accessToken || !user) {
      router.push("/auth")
    } else {
      // Role-based redirection logic
      let rolePath = 'patient'; 
      
      if (user.role === 'hospital_staff') {
        rolePath = 'hospital';
      } else if (user.role === 'insurance_reviewer') {
        rolePath = 'insurance';
      } else if (user.role === 'admin' || user.email?.includes('admin') || user.email === 'ale@kalbe.co.id') {
        rolePath = 'admin';
      } else if (user.role) {
        rolePath = user.role;
      }

      // console.log(`[AuthRedirect] User: ${user.email}, Role: ${user.role}, Target: /dashboard/${rolePath}`);
      router.push(`/dashboard/${rolePath}`)
    }
  }, [user, accessToken, isLoading, router])

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ShieldCheckIcon className="size-12 text-primary animate-pulse" />
        <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
           <Loader2Icon className="size-4 animate-spin" />
           Memeriksa sesi keamanan...
        </div>
      </div>
    </div>
  )
}
