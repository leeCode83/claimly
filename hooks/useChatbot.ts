"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export type Message = {
  role: "assistant" | "user"
  content: string
}

export type ChatStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error"

interface ChatbotOptions {
  accessToken: string | null
  onPasswordRequired?: (diagnosis?: string) => void
}

const WS_URL = process.env.NEXT_PUBLIC_CHATBOT_WS_URL || "ws://localhost:8000/ws/chat"
const MAX_RECONNECT_TIME = 60000 // 1 minute
const INITIAL_RECONNECT_DELAY = 1000 // 1s
const MAX_RECONNECT_DELAY = 16000 // 16s

export function useChatbot({ accessToken, onPasswordRequired }: ChatbotOptions) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Halo! Saya asisten AI Claimly. Ada yang bisa saya bantu terkait rekam medis atau klaim asuransi Anda hari ini?" }
  ])
  const [status, setStatus] = useState<ChatStatus>("idle")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const startConnectingTime = useRef<number | null>(null)
  const lastPrompt = useRef<string | null>(null)
  
  // Use a ref for the callback to prevent reconnection loops if the caller doesn't memoize it
  const onPasswordRequiredRef = useRef(onPasswordRequired)
  useEffect(() => {
    onPasswordRequiredRef.current = onPasswordRequired
  }, [onPasswordRequired])

  const connect = useCallback(() => {
    if (!accessToken || ws.current?.readyState === WebSocket.OPEN) return

    // Clear any existing reconnect timer
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }

    if (reconnectAttempts.current === 0) {
      startConnectingTime.current = Date.now()
      setStatus("connecting")
    } else {
      setStatus("reconnecting")
    }

    try {
      console.log(`[useChatbot] Connecting to ${WS_URL}...`)
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => {
        console.log("[useChatbot] Connected")
        setStatus("connected")
        reconnectAttempts.current = 0
        startConnectingTime.current = null
        
        // If we have a pending prompt from a disconnect, resend it
        if (lastPrompt.current) {
          console.log("[useChatbot] Resending last prompt...")
          sendMessageInternal(lastPrompt.current)
          lastPrompt.current = null
        }
      }

      ws.current.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data)

            switch (data.type) {
            case "session_init":
                console.log("[useChatbot] Session initialized:", data.session_id)
                break

            case "status":
                setStatusMessage(data.msg)
                setIsTyping(true)
                break

            case "chunk":
                setIsTyping(true)
                setStatusMessage(null)
                setMessages((prev) => {
                const lastMessage = prev[prev.length - 1]
                if (lastMessage && lastMessage.role === "assistant" && !data.is_first) {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + data.chunk
                    }
                    return newMessages
                } else {
                    return [...prev, { role: "assistant", content: data.chunk }]
                }
                })
                
                if (data.is_final) {
                setIsTyping(false)
                }
                break

            case "password_required":
                setIsTyping(false)
                if (onPasswordRequiredRef.current) {
                onPasswordRequiredRef.current(data.diagnosis)
                }
                break

            case "error":
                console.error("[useChatbot] Server error:", data.msg)
                setStatusMessage(data.msg)
                setIsTyping(false)
                break
            }
        } catch (e) {
            console.error("[useChatbot] Failed to parse message:", e)
        }
      }

      ws.current.onclose = (event) => {
        console.log(`[useChatbot] Disconnected (code: ${event.code})`)
        ws.current = null
        
        const now = Date.now()
        const timeSpentTrying = startConnectingTime.current ? now - startConnectingTime.current : 0

        // Only try to reconnect if it wasn't a clean close and we haven't timed out
        if (timeSpentTrying < MAX_RECONNECT_TIME) {
          const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current), MAX_RECONNECT_DELAY)
          console.log(`[useChatbot] Reconnect attempt ${reconnectAttempts.current + 1} in ${delay}ms...`)
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else {
          console.error("[useChatbot] Reconnection timeout reached")
          setStatus("error")
          setStatusMessage("Gagal terhubung ke chatbot. Silakan periksa koneksi atau refresh halaman.")
        }
      }

      ws.current.onerror = (error) => {
        // WebSocket onerror doesn't provide detail, onclose will handle the retry
        console.error("[useChatbot] WebSocket encountered an error")
      }
    } catch (err) {
      console.error("[useChatbot] Connection setup error:", err)
      setStatus("error")
    }
  }, [accessToken]) // Stable dependencies now

  useEffect(() => {
    connect()
    return () => {
      console.log("[useChatbot] Cleaning up...")
      if (ws.current) {
        ws.current.onclose = null // Prevent re-triggering connect during cleanup
        ws.current.close()
        ws.current = null
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }
    }
  }, [connect])

  const sendMessageInternal = useCallback((prompt: string, password?: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn("[useChatbot] WS not ready, saving prompt for later")
      lastPrompt.current = prompt
      return
    }

    ws.current.send(JSON.stringify({
      prompt,
      accessToken,
      password
    }))
  }, [accessToken])

  const sendMessage = useCallback((prompt: string, password?: string) => {
    // Only add to message history if it's a new prompt (not a password retry)
    if (!password) {
        setMessages((prev) => [...prev, { role: "user", content: prompt }])
    }
    
    lastPrompt.current = prompt
    setIsTyping(true)
    sendMessageInternal(prompt, password)
  }, [sendMessageInternal])

  const clearMessages = useCallback(() => {
    setMessages([
        { role: "assistant", content: "Halo! Saya asisten AI Claimly. Ada yang bisa saya bantu terkait rekam medis atau klaim asuransi Anda hari ini?" }
    ])
  }, [])

  return {
    messages,
    status,
    statusMessage,
    isTyping,
    sendMessage,
    clearMessages
  }
}
