"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/context/AuthContext"
import { LogOutIcon, ShieldCheckIcon, LayoutDashboardIcon, MessageCircleIcon, UserIcon, ShieldAlertIcon, CheckCircle2Icon, Loader2Icon, KeyIcon } from "lucide-react"
import { useUsers } from "@/hooks/useUsers"
import { useAuth } from "@/hooks/useAuth"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, accessToken, logoutLocal } = useAuthContext()
  const { getMe } = useUsers(accessToken)
  const { initZkpKeys } = useAuth(accessToken)

  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [fullUserData, setFullUserData] = useState<any>(null)
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [setupPassword, setSetupPassword] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const fetchFullProfile = async () => {
    if (!accessToken) return
    setIsDataLoading(true)
    try {
      const data = await getMe()
      setFullUserData(data)
    } catch (err) {
      console.error("Failed to fetch full profile", err)
    } finally {
      setIsDataLoading(false)
    }
  }

  useEffect(() => {
    if (isProfileOpen) {
      fetchFullProfile()
    }
  }, [isProfileOpen])

  const handleSetupKeys = async () => {
    if (!setupPassword) {
      toast.error("Password diperlukan", { description: "Password dibutuhkan untuk mengenkripsi kunci keamanan lokal Anda." })
      return
    }

    setIsGenerating(true)
    try {
      await initZkpKeys(setupPassword)
      await fetchFullProfile()
      setSetupPassword("")
    } catch (err: any) {
      // toast already handled in useAuth
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogout = () => {
    logoutLocal()
    router.push("/auth")
  }

  if (pathname === "/auth") return null

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-xs">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary">
            <ShieldCheckIcon className="size-6" />
            <span className="hidden sm:inline-block">Claimly</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm font-medium">
            {user && (
               <Link
                href={`/dashboard/${user.role === 'hospital_staff' ? 'hospital' : user.role === 'insurance_reviewer' ? 'insurance' : user.role}`}
                className={cn(
                  "transition-colors hover:text-primary",
                  pathname.includes("/dashboard") ? "text-primary" : "text-muted-foreground"
                )}
              >
                Dashboard
              </Link>
            )}
            {user?.role === 'patient' && (
              <Link
                href="/chatbot"
                className={cn(
                  "transition-colors hover:text-primary",
                  pathname === "/chatbot" ? "text-primary" : "text-muted-foreground"
                )}
              >
                AI Assistant
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs opacity-70">{user.email}</span>
              
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserIcon className="size-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Profil Pengguna</DialogTitle>
                    <DialogDescription>
                      Informasi akun dan status keamanan enkripsi Anda.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right font-semibold">Nama</Label>
                      <div className="col-span-2">{fullUserData?.full_name || user.full_name || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right font-semibold">Email</Label>
                      <div className="col-span-2 text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right font-semibold">Peran</Label>
                      <div className="col-span-2 uppercase tracking-tight text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 w-fit border border-primary/20">
                        {fullUserData?.role?.replace('_', ' ') || user.role?.replace('_', ' ')}
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="text-sm font-semibold mb-4">Status Keamanan (ZKP)</h4>
                      
                      {isDataLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" /> Sedang mengecek status...
                        </div>
                      ) : fullUserData?.public_key ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                          <CheckCircle2Icon className="size-5" />
                          <div>
                            <p className="text-sm font-medium">Kunci Keamanan Aktif</p>
                            <p className="text-[11px] opacity-80 text-green-600 font-mono translate-y-[-2px]">PK: {fullUserData.public_key.substring(0, 16)}...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                            <ShieldAlertIcon className="size-5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">Kunci Belum Dibuat</p>
                              <p className="text-xs opacity-80 text-amber-700 italic">Data medis hanya bisa diakses setelah kunci divalidasi.</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="setup-password">Buat Password Kunci Keamanan</Label>
                            <div className="flex gap-2">
                              <Input 
                                id="setup-password" 
                                type="password" 
                                placeholder="Min. 8 karakter" 
                                value={setupPassword}
                                onChange={(e) => setSetupPassword(e.target.value)}
                                className="h-9"
                              />
                              <Button 
                                onClick={handleSetupKeys} 
                                disabled={isGenerating || !setupPassword}
                                size="sm"
                                className="shrink-0 gap-2 h-9"
                              >
                                {isGenerating ? <Loader2Icon className="size-4 animate-spin" /> : <KeyIcon className="size-4" />}
                                Setup
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground px-1">
                              *Password ini digunakan untuk mengenkripsi private key Anda secara lokal di browser. Jangan sampai lupa!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOutIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/auth">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
