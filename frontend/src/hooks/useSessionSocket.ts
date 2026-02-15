import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePolling } from './usePolling'
import api from '@/lib/api'
import type { Session, SessionTimer } from '@/types'

interface SessionSocketState {
    isConnected: boolean
    session: Session | null
    activeTimer: SessionTimer | null
    yourCredits: number
    error: string | null
}

interface SessionSocketActions {
    startTimer: () => void
    stopTimer: () => void
    endSession: () => void
    reconnect: () => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    sendWhiteboard: (data: unknown) => void
    sendCode: (data: unknown) => void
}

const POLL_INTERVAL = 1500 // 1.5 seconds for active collaboration

export function useSessionSocket(sessionId: string | number | undefined): SessionSocketState & SessionSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const [activeTimer, setActiveTimer] = useState<SessionTimer | null>(null)
    const [yourCredits, setYourCredits] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const lastSyncTimeRef = useRef<string | null>(null)
    const lastSignalTimeRef = useRef<string | null>(null)
    const { accessToken, isAuthenticated, user, updateCredits } = useAuthStore()

    const fetchUpdates = useCallback(async () => {
        const id = String(sessionId)
        if (!sessionId || id === 'undefined' || id === 'NaN' || !accessToken || !isAuthenticated) {
            return
        }

        try {
            const response = await api.get(`/sessions/${sessionId}/updates/`)
            const data = response.data

            setSession(data.session)
            setActiveTimer(data.session.active_timer)
            setIsConnected(true)

            if (data.your_credits !== undefined) {
                setYourCredits(data.your_credits)
                updateCredits(data.your_credits)
            }

            // WebRTC Signaling Buffer
            if (data.signal_data && data.signal_timestamp !== lastSignalTimeRef.current) {
                const sig = data.signal_data
                const myId = user?.id

                // 1. Process discrete signals (offer, answer, ready)
                if (sig.offer && sig.offer.sender_id !== myId) {
                    window.dispatchEvent(new CustomEvent('signal', { detail: sig.offer }))
                }
                if (sig.answer && sig.answer.sender_id !== myId) {
                    window.dispatchEvent(new CustomEvent('signal', { detail: sig.answer }))
                }
                if (sig.ready_signal && sig.ready_signal.sender_id !== myId) {
                    window.dispatchEvent(new CustomEvent('signal', { detail: sig.ready_signal }))
                }

                // 2. Process all recent candidates from the other user
                const peerRole = data.session.user1 === myId ? 'callee' : 'caller'
                const peerCandidates = sig[`candidates_${peerRole}`]

                if (peerCandidates && Array.isArray(peerCandidates)) {
                    peerCandidates.forEach((candidate: any) => {
                        window.dispatchEvent(new CustomEvent('signal', { detail: candidate }))
                    })
                }

                lastSignalTimeRef.current = data.signal_timestamp
            }

            // Collaborative sync (Whiteboard/Code)
            if (data.last_sync_by !== user?.id && data.last_sync_time !== lastSyncTimeRef.current) {
                if (data.whiteboard_data) {
                    window.dispatchEvent(new CustomEvent('whiteboard_update', {
                        detail: { data: data.whiteboard_data }
                    }))
                }
                if (data.code_data) {
                    // Backend returns code_data as a JSON object containing files/activeIndex
                    window.dispatchEvent(new CustomEvent('code_update', {
                        detail: { data: data.code_data }
                    }))
                }
                lastSyncTimeRef.current = data.last_sync_time
            }
        } catch (error) {
            console.error('Failed to poll session updates:', error)
            setIsConnected(false)
            setError('Connection lost. Retrying...')
        }
    }, [sessionId, accessToken, isAuthenticated, user?.id, updateCredits])

    usePolling(fetchUpdates, {
        interval: POLL_INTERVAL,
        enabled: !!sessionId && !!accessToken && isAuthenticated,
        immediate: true
    }, [fetchUpdates])

    const startTimer = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/timer/start/`)
            fetchUpdates()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start timer')
        }
    }, [sessionId, fetchUpdates])

    const stopTimer = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/timer/stop/`)
            fetchUpdates()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to stop timer')
        }
    }, [sessionId, fetchUpdates])

    const endSession = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/end/`)
            fetchUpdates()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to end session')
        }
    }, [sessionId, fetchUpdates])

    const sendWhiteboard = useCallback(async (data: unknown) => {
        try {
            await api.post(`/sessions/${sessionId}/sync/`, { whiteboard_data: data })
        } catch (error) {
            console.error('Failed to sync whiteboard:', error)
        }
    }, [sessionId])

    const sendCode = useCallback(async (data: unknown) => {
        try {
            await api.post(`/sessions/${sessionId}/sync/`, { code_data: data })
        } catch (error) {
            console.error('Failed to sync code:', error)
        }
    }, [sessionId])

    const sendMessage = useCallback(async (type: string, data: Record<string, unknown> = {}) => {
        // Signaling uses this. 
        // We merge type into data to match the expected format: { type: 'offer', sdp: ... }
        try {
            await api.post(`/sessions/${sessionId}/sync/`, {
                signal_data: { type, ...data }
            })
        } catch (error) {
            console.error('Failed to send signal:', error)
        }
    }, [sessionId])

    const reconnect = useCallback(() => {
        fetchUpdates()
    }, [fetchUpdates])

    // Initialize credits from user
    useEffect(() => {
        if (user?.credits !== undefined) {
            setYourCredits(Number(user.credits))
        }
    }, [isAuthenticated, user?.credits])

    return {
        isConnected,
        session,
        activeTimer,
        yourCredits,
        error,
        startTimer,
        stopTimer,
        endSession,
        reconnect,
        sendMessage,
        sendWhiteboard,
        sendCode,
    }
}
