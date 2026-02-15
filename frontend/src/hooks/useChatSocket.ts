import { useEffect, useCallback, useState, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePolling } from './usePolling'
import api from '@/lib/api'

interface ChatMessage {
    id: number
    sender: number
    sender_name: string
    message: string
    timestamp: string
}

interface ChatSocketState {
    isConnected: boolean
    messages: ChatMessage[]
}

interface ChatSocketActions {
    sendMessage: (message: string) => void
    reconnect: () => void
}

const POLL_INTERVAL = 3000 // Poll every 3 seconds for chat

export function useChatSocket(sessionId: string | number | undefined): ChatSocketState & ChatSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const lastIdRef = useRef<number | null>(null)

    const { accessToken, isAuthenticated } = useAuthStore()

    const fetchMessages = useCallback(async () => {
        const sid = String(sessionId)
        if (!sessionId || sid === 'undefined' || sid === 'NaN' || !accessToken || !isAuthenticated) return

        try {
            const params = lastIdRef.current ? { since_id: lastIdRef.current } : {}
            const response = await api.get(`/chat/${sessionId}/messages/`, { params })

            const newMessages = response.data
            if (Array.isArray(newMessages) && newMessages.length > 0) {
                if (lastIdRef.current === null) {
                    // Initial load
                    setMessages(newMessages)
                } else {
                    // Append new messages
                    setMessages(prev => [...prev, ...newMessages])
                }
                lastIdRef.current = newMessages[newMessages.length - 1].id
            }
            setIsConnected(true)
        } catch (error) {
            console.error('Failed to poll chat messages:', error)
            setIsConnected(false)
        }
    }, [sessionId, accessToken, isAuthenticated])

    usePolling(fetchMessages, {
        interval: POLL_INTERVAL,
        enabled: !!sessionId && !!accessToken && isAuthenticated,
        immediate: true
    }, [fetchMessages])

    const sendMessage = useCallback(async (message: string) => {
        if (!message.trim() || !sessionId) return

        try {
            const response = await api.post(`/chat/${sessionId}/send/`, {
                message: message.trim()
            })
            // Immediately update local messages to feel responsive
            setMessages(prev => [...prev, response.data])
            lastIdRef.current = response.data.id
        } catch (error) {
            console.error('Failed to send message:', error)
        }
    }, [sessionId])

    const reconnect = useCallback(() => {
        fetchMessages()
    }, [fetchMessages])

    // Cleanup on session change
    useEffect(() => {
        setMessages([])
        lastIdRef.current = null
    }, [sessionId])

    return {
        isConnected,
        messages,
        sendMessage,
        reconnect,
    }
}
