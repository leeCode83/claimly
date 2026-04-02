"use client"

import { useState, useEffect, useRef } from "react"
import { MessageCircleIcon, SendIcon, ShieldCheckIcon, UserIcon, BotIcon, LockIcon, Loader2Icon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useClaimlyChat } from "@/hooks/useClaimlyChat"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function ChatbotPage() {
  const { 
    messages, 
    sendMessage, 
    resubmitWithPassword, 
    isTyping, 
    isConnected, 
    passwordRequest 
  } = useClaimlyChat()
  
  const [inputValue, setInputValue] = useState("")
  const [passwordValue, setPasswordValue] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue("")
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordRequest && passwordValue) {
      resubmitWithPassword(passwordValue, passwordRequest.correlationId)
      setPasswordValue("")
    }
  }

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-xs font-medium">
          <div className={cn("size-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
          {isConnected ? "Connected to Secure Node" : "Disconnecting..."}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full shadow-lg border-primary/10">
        <CardHeader className="border-b bg-muted/30 py-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
             <BotIcon className="size-4 text-primary" />
             Dr. Claimly
          </CardTitle>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 px-2 py-0.5 rounded bg-background border">
            <LockIcon className="size-2.5" />
            ZERO-PERSISTENCE
          </div>
        </CardHeader>
        <CardContent 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
           {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                <BotIcon className="size-12 mb-4 text-primary/40" />
                <p className="text-sm max-w-xs">
                  Halo! Saya asisten AI Claimly. Ada yang bisa saya bantu terkait rekam medis atau klaim asuransi Anda hari ini?
                </p>
             </div>
           )}
           
           {messages.map((ms, idx) => (
             <div key={idx} className={cn(
               "flex w-max max-w-[85%] flex-col gap-2 rounded-2xl px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300",
               ms.role === "assistant" 
                ? "bg-muted text-foreground self-start rounded-tl-none border shadow-sm" 
                : "bg-primary text-primary-foreground self-end rounded-tr-none shadow-md"
             )}>
                <div className="flex items-center gap-2 mb-0.5">
                   {ms.role === 'assistant' ? <BotIcon className="size-3.5" /> : <UserIcon className="size-3.5" />}
                   <span className="font-bold opacity-70 text-[10px] uppercase tracking-wider">{ms.role === 'assistant' ? 'Dr. Claimly' : 'You'}</span>
                </div>
                <div className={cn(
                  "leading-relaxed",
                  ms.role === "assistant" ? "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent" : "whitespace-pre-wrap"
                )}>
                  {ms.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {ms.content}
                    </ReactMarkdown>
                  ) : (
                    ms.content
                  )}
                </div>
             </div>
           ))}

           {isTyping && (
             <div className="bg-muted text-foreground self-start rounded-2xl rounded-tl-none border shadow-sm px-4 py-3 animate-pulse">
                <div className="flex gap-1">
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-bounce" />
                </div>
             </div>
           )}
        </CardContent>
        <CardFooter className="border-t p-4 bg-muted/10">
           <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
            className="flex w-full items-center gap-2"
           >
              <Input 
                placeholder="Tanyakan tentang diagnosa, klaim, atau rekam medis..." 
                className="flex-1 bg-background border-primary/10 focus-visible:ring-primary shadow-inner" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={!isConnected}
              />
              <Button type="submit" size="icon" disabled={!inputValue.trim() || !isConnected} className="shadow-sm">
                <SendIcon className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
           </form>
        </CardFooter>
      </Card>

      {/* Password Request Dialog */}
      <Dialog open={!!passwordRequest} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <LockIcon className="size-4" />
              Dekripsi Data Diperlukan
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              Dr. Claimly menemukan catatan tentang <span className="font-bold text-primary">{passwordRequest?.diagnosis}</span>, masukkan password Anda untuk melihat detailnya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Masukkan password Anda"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                autoFocus
                className="focus-visible:ring-primary"
              />
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                className="w-full sm:w-auto"
                disabled={!passwordValue}
              >
                Dekripsi & Lanjutkan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="text-center mt-4 text-xs text-muted-foreground flex items-center justify-center gap-4">
        <span className="flex items-center gap-1">
          <div className="size-1.5 rounded-full bg-green-500/50" />
          KMS Active
        </span>
        <span className="flex items-center gap-1">
          <div className="size-1.5 rounded-full bg-blue-500/50" />
          ZKP Verified
        </span>
        <span>AI dapat membuat kesalahan. Selalu konsultasikan dengan tenaga medis ahli.</span>
      </div>
    </div>
  )
}

