"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheckIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthContext } from "@/context/AuthContext"

export default function AuthPage() {
  const { signIn, isLoading, accessToken, user } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && accessToken && user) {
      let redirectPath = '/dashboard'
      if (user.role === 'hospital_staff') redirectPath = '/dashboard/hospital'
      else if (user.role === 'insurance_reviewer') redirectPath = '/dashboard/insurance'
      else if (user.role === 'patient') redirectPath = '/dashboard/patient'
      else if (user.role === 'admin') redirectPath = '/dashboard/admin'
      
      router.push(redirectPath)
    }
  }, [isLoading, accessToken, user, router])

  return (
    <div className="container relative flex h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center gap-2 text-lg font-medium">
          <ShieldCheckIcon className="size-8 text-primary" />
          Claimly
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Platform klaim asuransi pertama yang menerapkan arsitektur Zero-Knowledge untuk melindungi privasi rekam medis Anda sepenuhnya.&rdquo;
            </p>
            <footer className="text-sm">Tim Keamanan Claimly</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Masuk ke Claimly</CardTitle>
              <CardDescription>
                Gunakan akun SSO Keycloak Anda untuk mengakses platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button 
                variant="outline" 
                className="h-12 w-full text-base font-semibold" 
                onClick={() => signIn()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="mr-2 h-5 w-5 text-primary" />
                )}
                Masuk dengan Keycloak
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col text-center text-xs text-muted-foreground">
              <p>
                Otentikasi aman dikelola oleh infrastruktur CDT Kalbe Farma.
              </p>
            </CardFooter>
          </Card>
          <p className="px-8 text-center text-sm text-muted-foreground">
            Dengan mendaftar, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami.
          </p>
        </div>
      </div>
    </div>
  )
}
