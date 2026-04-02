"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";

export interface Message {
  role: "user" | "assistant";
  content: string;
  status?: string;
}

export interface PasswordRequest {
  diagnosis: string;
  correlationId: string;
}

interface WSMessage {
  type: "session_init" | "status" | "chunk" | "error" | "password_required";
  session_id?: string;
  msg?: string;
  chunk?: string;
  is_final?: boolean;
  diagnosis?: string;
  correlation_id?: string;
  cid?: string;
}

export const useClaimlyChat = () => {
  const { accessToken } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const wsUrl = process.env.NEXT_PUBLIC_CHATBOT_WS_URL || "ws://localhost:8000/ws/chat";

  // Initialize and maintain WebSocket connection
  useEffect(() => {
    const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected to Claimly Chatbot");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      socket.onerror = (error) => {
        // Only log error if the socket is not being intentionally closed
        if (socket.readyState !== WebSocket.CLOSED) {
          console.warn("WebSocket status check:", error);
          // Only show toast for actual connection failures, not during dev reloads
          if (socket.readyState === WebSocket.CONNECTING) {
            toast.error("Gagal terhubung ke chatbot", {
                description: "Pastikan service backend sudah menyala."
            });
          }
        }
      };

      socket.onclose = (event) => {
        if (!event.wasClean) {
          console.warn("Chatbot connection closed unexpectedly:", event.code);
        } else {
          console.log("Chatbot session closed safely");
        }
        setIsConnected(false);
        setSessionId(null);
      };

      socketRef.current = socket;
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [wsUrl]);

  const handleWebSocketMessage = (data: WSMessage) => {
    switch (data.type) {
      case "session_init":
        if (data.session_id) setSessionId(data.session_id);
        break;

      case "status":
        setIsTyping(true);
        // Optionally update the last message or show a status indicator
        break;

      case "password_required":
        setIsTyping(false);
        setPasswordRequest({
          diagnosis: data.diagnosis || "Unknown",
          correlationId: data.correlation_id || ""
        });
        break;

      case "chunk":
        setIsTyping(true);
        updateLastAssistantMessage(data.chunk || "", data.is_final || false);
        break;

      case "error":
        setIsTyping(false);
        toast.error("Chatbot Error", {
          description: data.msg || "Terjadi kesalahan pada layanan AI."
        });
        break;

      default:
        console.warn("Unknown message type received:", data.type);
    }
  };

  const updateLastAssistantMessage = (chunk: string, isFinal: boolean) => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        // Append chunk to the existing assistant message
        const updatedMessages = [...prev];
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + chunk,
        };
        return updatedMessages;
      } else {
        // Create a new assistant message
        return [...prev, { role: "assistant", content: chunk }];
      }
    });

    if (isFinal) {
      setIsTyping(false);
    }
  };

  const sendMessage = useCallback((prompt: string, password?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Koneksi terputus", {
        description: "Mencoba menghubungkan kembali..."
      });
      return;
    }

    // Clear any pending password request
    setPasswordRequest(null);

    // Add user message to state
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setIsTyping(true);

    const payload = {
      prompt,
      password: password || "",
      accessToken,
    };

    socketRef.current.send(JSON.stringify(payload));
  }, [accessToken]);

  const resubmitWithPassword = useCallback((password: string, correlationId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    // Clear request state
    setPasswordRequest(null);
    setIsTyping(true);

    const payload = {
      password: password || "",
      correlation_id: correlationId,
      accessToken,
    };

    socketRef.current.send(JSON.stringify(payload));
  }, [accessToken]);



  return {
    messages,
    setMessages,
    isConnected,
    isTyping,
    passwordRequest,
    sendMessage,
    resubmitWithPassword,
    sessionId,
  };
};
