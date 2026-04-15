"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageCircleIcon, SendIcon, ShieldCheckIcon, UserIcon, BotIcon, LockIcon, RefreshCwIcon, AlertCircleIcon, Trash2Icon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useChatbot } from "@/hooks/useChatbot"
import { useAuthContext } from "@/context/AuthContext"

export default function ChatbotPage() {
  const { accessToken } = useAuthContext()
  const [inputValue, setInputValue] = useState("")
  
  // Password Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentDiagnosis, setCurrentDiagnosis] = useState<string | undefined>()
  const [passwordInput, setPasswordInput] = useState("")
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)

  const onPasswordRequired = useCallback((diagnosis?: string) => {
    setCurrentDiagnosis(diagnosis)
    setPasswordModalOpen(true)
  }, [])

  const { 
    messages, 
    status, 
    statusMessage, 
    isTyping, 
    sendMessage, 
    clearMessages 
  } = useChatbot({
    accessToken,
    onPasswordRequired
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSendMessage = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim()) return
    
    setPendingPrompt(inputValue)
    sendMessage(inputValue)
    setInputValue("")
  }, [inputValue, sendMessage])

  const handlePasswordSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordInput.trim() || !pendingPrompt) return

    sendMessage(pendingPrompt, passwordInput)
    setPasswordInput("")
    setPasswordModalOpen(false)
    toast.success("Password dikirimkan. Membuka rekam medis...")
  }, [passwordInput, pendingPrompt, sendMessage])

  return (
    <div className="container mx-auto py-8 px-4 h-[calc(100vh-4rem)] flex flex-col">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Health Assistant</h1>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <ShieldCheckIcon className="size-4 text-green-600" />
            End-to-End Encrypted Conversation
          </p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full shadow-lg border-primary/10 bg-background/50 backdrop-blur-sm">
        <CardHeader className="border-b bg-muted/30 py-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
             <div className={cn(
               "size-2 rounded-full",
               status === 'connected' ? "bg-green-500 animate-pulse" : 
               status === 'reconnecting' || status === 'connecting' ? "bg-yellow-500 animate-bounce" : 
               "bg-red-500"
             )} />
             <CardTitle className="text-sm font-medium">
                {status === 'connected' ? "AI Assistant Online" : 
                 status === 'reconnecting' ? "Menghubungkan kembali..." : 
                 status === 'connecting' ? "Menghubungkan..." : 
                 "Offline"}
             </CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={clearMessages}
            title="Bersihkan riwayat chat"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </CardHeader>
        
        {status === 'reconnecting' && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 py-1.5 px-4 flex items-center gap-2 text-xs text-yellow-700 animate-in fade-in slide-in-from-top-1">
            <RefreshCwIcon className="size-3 animate-spin" />
            <span>Koneksi terputus. Mencoba menghubungkan kembali...</span>
          </div>
        )}

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
           {messages.map((ms, idx) => (
              <div key={idx} className={cn(
                "flex w-full",
                ms.role === "assistant" ? "justify-start" : "justify-end"
              )}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  ms.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-sm border border-primary/5"
                    : "bg-primary text-primary-foreground rounded-tr-sm shadow-md"
                )}>
                  <div className="flex items-center gap-1.5 mb-1 opacity-60">
                    {ms.role === 'assistant' ? <BotIcon className="size-3" /> : <UserIcon className="size-3" />}
                    <span className="font-semibold text-[10px] uppercase tracking-wider">
                      {ms.role === 'assistant' ? 'Claimly AI' : 'Anda'}
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown>{ms.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex w-full justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-muted text-foreground animate-pulse border border-primary/5">
                  <div className="flex items-center gap-1.5 mb-1 opacity-60">
                    <BotIcon className="size-3" />
                    <span className="font-semibold text-[10px] uppercase tracking-wider">AI Thinking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="size-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="size-1.5 bg-primary/40 rounded-full animate-bounce" />
                    {statusMessage && <span className="ml-2 text-xs italic text-muted-foreground">{statusMessage}</span>}
                  </div>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircleIcon className="size-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Koneksi Gagal</p>
                  <p className="text-xs text-muted-foreground max-w-[250px]">
                    {statusMessage || "Tidak dapat memulihkan koneksi ke server chatbot."}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Muat Ulang Halaman
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
        </CardContent>
        <CardFooter className="border-t p-4 bg-background">
           <form 
            onSubmit={handleSendMessage} 
            className="flex w-full items-center gap-2"
           >
              <Input 
                placeholder={status === 'connected' ? "Tanyakan tentang rekam medis Anda..." : "Sedang menghubungkan..."}
                className="flex-1 bg-muted/50 border-primary/5 focus-visible:ring-primary" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={status !== 'connected' || isTyping}
              />
              <Button type="submit" size="icon" disabled={!inputValue.trim() || status !== 'connected' || isTyping}>
                <SendIcon className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
           </form>
        </CardFooter>
      </Card>

      {/* Password Modal (E2EE) */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="sm:max-w-md border-primary/10 bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockIcon className="size-5 text-primary" />
              Akses Data Medis Terproteksi
            </DialogTitle>
            <DialogDescription>
              AI mendeteksi data rekam medis terenkripsi {currentDiagnosis && <span>untuk diagnosa <strong>{currentDiagnosis}</strong></span>}. Silakan masukkan password Anda untuk membukanya.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 py-4">
             <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ShieldCheckIcon className="size-6 text-blue-600" />
             </div>
             <div className="flex-1 space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  *Password hanya dikirim ke memori sementara server dan tidak akan disimpan.
                </p>
             </div>
          </div>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Masukkan Password Rekam Medis"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="bg-muted/50"
              />
              <DialogFooter className="sm:justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPasswordModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={!passwordInput.trim()}>
                  Dekripsi & Baca Data
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="text-center mt-4 text-xs text-muted-foreground">
        AI dapat membuat kesalahan. Selalu konsultasikan dengan tenaga medis ahli.
      </div>
    </div>
  )
}
