"use client"

import { useState } from "react"
import { MessageCircleIcon, SendIcon, ShieldCheckIcon, UserIcon, BotIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Halo! Saya asisten AI Claimly. Ada yang bisa saya bantu terkait rekam medis atau klaim asuransi Anda hari ini?" },
    { role: "user", content: "Bagaimana status klaim saya di RS Medika?" },
    { role: "assistant", content: "Berdasarkan data terenkripsi lokal Anda, klaim CLM-0921 saat ini sedang dalam tahap review oleh pihak asuransi. Bukti ZKP Anda sudah berhasil diverifikasi." }
  ])
  const [inputValue, setInputValue] = useState("")

  const handleSendMessage = () => {
    if (!inputValue.trim()) return
    setMessages([...messages, { role: "user", content: inputValue }])
    setInputValue("")
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "Maaf, fitur asisten AI saat ini masih dalam tahap dummy. Chatbot akan segera terhubung dengan rekam medis terenkripsi Anda." }])
    }, 1000)
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
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full shadow-lg border-primary/10">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
             <div className="size-2 rounded-full bg-green-500 animate-pulse" />
             AI Assistant Online
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
           {messages.map((ms, idx) => (
             <div key={idx} className={cn(
               "flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-4 py-3 text-sm",
               ms.role === "assistant" 
                ? "bg-muted text-foreground self-start" 
                : "bg-primary text-primary-foreground self-end"
             )}>
                <div className="flex items-center gap-2 mb-1">
                   {ms.role === 'assistant' ? <BotIcon className="size-3.5" /> : <UserIcon className="size-3.5" />}
                   <span className="font-bold opacity-70 text-[10px] uppercase tracking-wider">{ms.role}</span>
                </div>
                {ms.content}
             </div>
           ))}
        </CardContent>
        <CardFooter className="border-t p-4">
           <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
            className="flex w-full items-center gap-2"
           >
              <Input 
                placeholder="Tanyakan sesuatu..." 
                className="flex-1" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={!inputValue.trim()}>
                <SendIcon className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
           </form>
        </CardFooter>
      </Card>
      <div className="text-center mt-4 text-xs text-muted-foreground">
        AI dapat membuat kesalahan. Selalu konsultasikan dengan tenaga medis ahli.
      </div>
    </div>
  )
}
