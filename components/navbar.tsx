"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/context/AuthContext"
import { LogOutIcon, ShieldCheckIcon, LayoutDashboardIcon, MessageCircleIcon } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logoutLocal } = useAuthContext()

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
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{user.email}</span>
              <Button variant="ghost" size="icon-sm" onClick={handleLogout} title="Logout">
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
