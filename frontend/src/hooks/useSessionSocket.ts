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
    isPeerInRoom: boolean
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
const processedSignalsCache = new Set<string>()

export function useSessionSocket(sessionId: string | number | undefined): SessionSocketState & SessionSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const [activeTimer, setActiveTimer] = useState<SessionTimer | null>(null)
    const [yourCredits, setYourCredits] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [isPeerInRoom, setIsPeerInRoom] = useState(false)

    const lastSyncVersionRef = useRef<number>(0)
    const lastSignalTimeRef = useRef<string | null>(null)

    // FIX: Extract volatile auth values into refs so they don't rebuild fetchUpdates
    // every time credits update (which was resetting the polling interval and skipping timer ticks)
    const { accessToken, isAuthenticated, user, updateCredits } = useAuthStore()
    const accessTokenRef = useRef(accessToken)
    const isAuthenticatedRef = useRef(isAuthenticated)
    const userIdRef = useRef(user?.id)
    const updateCreditsRef = useRef(updateCredits)

    // Keep refs in sync with latest values
    useEffect(() => { accessTokenRef.current = accessToken }, [accessToken])
    useEffect(() => { isAuthenticatedRef.current = isAuthenticated }, [isAuthenticated])
    useEffect(() => { userIdRef.current = user?.id }, [user?.id])
    useEffect(() => { updateCreditsRef.current = updateCredits }, [updateCredits])

    // Initialize credits from user on mount
    useEffect(() => {
        if (user?.credits !== undefined) {
            setYourCredits(Number(user.credits))
        }
    }, [isAuthenticated, user?.credits])

    // FIX: fetchUpdates now reads from refs, so its reference stays stable across re-renders.
    // This prevents usePolling from resetting the interval every time credits change.
    const fetchUpdates = useCallback(async () => {
        const id = String(sessionId)
        if (!sessionId || id === 'undefined' || id === 'NaN' || !accessTokenRef.current || !isAuthenticatedRef.current) {
            return
        }

        try {
            const response = await api.get(`/sessions/${sessionId}/updates/`)
            const data = response.data

            setSession(data.session)
            setActiveTimer(data.session.active_timer)
            setIsPeerInRoom(!!data.is_peer_in_room)
            setIsConnected(true)

            if (data.your_credits !== undefined) {
                setYourCredits(data.your_credits)
                if (updateCreditsRef.current) {
                    updateCreditsRef.current(data.your_credits)
                }
            }

            // WebRTC Signaling Buffer
            if (data.signal_data && data.signal_timestamp !== lastSignalTimeRef.current) {
                const sig = data.signal_data
                const myId = userIdRef.current
                
                if (sig.offer && sig.offer.sender_id !== myId) {
                    const hash = JSON.stringify(sig.offer)
                    if (!processedSignalsCache.has(hash)) {
                        processedSignalsCache.add(hash)
                        window.dispatchEvent(new CustomEvent('signal', { detail: sig.offer }))
                    }
                }
                if (sig.answer && sig.answer.sender_id !== myId) {
                    const hash = JSON.stringify(sig.answer)
                    if (!processedSignalsCache.has(hash)) {
                        processedSignalsCache.add(hash)
                        window.dispatchEvent(new CustomEvent('signal', { detail: sig.answer }))
                    }
                }
                if (sig.ready_signal && sig.ready_signal.sender_id !== myId) {
                    const hash = JSON.stringify(sig.ready_signal)
                    if (!processedSignalsCache.has(hash)) {
                        processedSignalsCache.add(hash)
                        window.dispatchEvent(new CustomEvent('signal', { detail: sig.ready_signal }))
                    }
                }

                const peerRole = data.session.user1 === myId ? 'callee' : 'caller'
                const peerCandidates = sig[`candidates_${peerRole}`]
                if (peerCandidates && Array.isArray(peerCandidates)) {
                    peerCandidates.forEach((candidate: any) => {
                        const hash = JSON.stringify(candidate)
                        if (!processedSignalsCache.has(hash)) {
                            processedSignalsCache.add(hash)
                            window.dispatchEvent(new CustomEvent('signal', { detail: candidate }))
                        }
                    })
                }

                lastSignalTimeRef.current = data.signal_timestamp
            }

            // Collaborative sync (Whiteboard/Code)
            // FIX: Check sync_by AND sync_version to ensure we only apply peer updates,
            // not our own echoes. sync_version is only updated on real data changes.
            const isFromPeer = data.last_sync_by !== userIdRef.current
            const isNewVersion = data.sync_version !== lastSyncVersionRef.current

            if (isFromPeer && isNewVersion) {
                if (data.whiteboard_data) {
                    window.dispatchEvent(new CustomEvent('whiteboard_update', {
                        detail: { data: data.whiteboard_data }
                    }))
                }
                if (data.code_data) {
                    window.dispatchEvent(new CustomEvent('code_update', {
                        detail: { data: data.code_data }
                    }))
                }
                lastSyncVersionRef.current = data.sync_version
            }
        } catch (error) {
            console.error('Failed to poll session updates:', error)
            setIsConnected(false)
            setError('Connection lost. Retrying...')
        }
    }, [sessionId])
 // FIX: Only depends on sessionId now - auth values read from refs

    usePolling(fetchUpdates, {
        interval: POLL_INTERVAL,
        enabled: !!sessionId && !!accessToken && isAuthenticated,
        immediate: true
    }, [fetchUpdates])

    // FIX: startTimer/stopTimer now await fetchUpdates so the UI updates INSTANTLY
    // instead of waiting for the next natural poll (up to 1.5s later)
    const startTimer = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/timer/start/`)
            await fetchUpdates() // await so UI reflects immediately
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start timer')
        }
    }, [sessionId, fetchUpdates])

    const stopTimer = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/timer/stop/`)
            await fetchUpdates() // await so UI reflects immediately
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to stop timer')
        }
    }, [sessionId, fetchUpdates])

    const endSession = useCallback(async () => {
        try {
            await api.post(`/sessions/${sessionId}/end/`)
            await fetchUpdates()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to end session')
        }
    }, [sessionId, fetchUpdates])

    const sendWhiteboard = useCallback(async (data: unknown) => {
        try {
            await api.post(`/sessions/${sessionId}/sync/`, { whiteboard_data: data })
            // Immediately re-poll so we confirm the sync landed
            // (don't await — fire-and-forget to avoid blocking drawing)
            fetchUpdates()
        } catch (error) {
            console.error('Failed to sync whiteboard:', error)
        }
    }, [sessionId, fetchUpdates])

    const sendCode = useCallback(async (data: unknown) => {
        try {
            await api.post(`/sessions/${sessionId}/sync/`, { code_data: data })
        } catch (error) {
            console.error('Failed to sync code:', error)
        }
    }, [sessionId])

    const sendMessage = useCallback(async (type: string, data: Record<string, unknown> = {}) => {
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
        isPeerInRoom
    }
}
