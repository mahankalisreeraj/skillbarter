import { create } from 'zustand'
import api from '@/lib/api'
import type { Session, Review, ReviewCreate } from '@/types'
import { useAuthStore } from './authStore'

interface SessionsState {
    sessions: Session[]
    currentSession: Session | null
    isLoading: boolean
    error: string | null

    // Actions
    fetchSessions: () => Promise<void>
    fetchSession: (id: number) => Promise<Session | null>
    createSession: (user2Id: number, learningRequestId?: number) => Promise<Session>
    respondToRequest: (sessionId: number, decision: 'accept' | 'reject') => Promise<Session>
    proposeTime: (sessionId: number, time: string) => Promise<Session>
    confirmTime: (sessionId: number) => Promise<Session>
    joinLobby: (sessionId: number) => Promise<Session>
    endSession: (id: number) => Promise<void>
    submitReview: (sessionId: number, review: ReviewCreate) => Promise<Review>
    clearError: () => void
    setCurrentSession: (session: Session | null) => void
}

export const useSessionsStore = create<SessionsState>((set) => ({
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,

    fetchSessions: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('sessions/')
            // Handle paginated response (Django REST returns { results: [...] })
            const sessions = Array.isArray(response.data)
                ? response.data
                : (response.data?.results ?? [])
            set({ sessions, isLoading: false })
        } catch (error) {
            set({ error: 'Failed to load sessions', isLoading: false })
        }
    },

    fetchSession: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`sessions/${id}/`)
            const session = response.data
            set({ currentSession: session, isLoading: false })
            return session
        } catch (error) {
            set({ error: 'Failed to load session', isLoading: false })
            return null
        }
    },

    createSession: async (user2Id: number, learningRequestId?: number) => {
        set({ error: null })
        try {
            // New flow expects post_id
            const payload: any = { user2: user2Id }
            if (learningRequestId) {
                payload.post_id = learningRequestId
            }

            const response = await api.post('sessions/', payload)
            const newSession = response.data

            set((state) => ({
                sessions: [newSession, ...state.sessions],
                currentSession: newSession,
            }))

            return newSession
        } catch (error: any) {
            set({ error: error.response?.data?.error || 'Failed to create session' })
            throw error
        }
    },

    respondToRequest: async (sessionId: number, decision: 'accept' | 'reject') => {
        try {
            const response = await api.post(`sessions/${sessionId}/respond/`, { decision })
            const updated = response.data
            set((state) => ({
                sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
                currentSession: state.currentSession?.id === sessionId ? updated : state.currentSession
            }))
            return updated
        } catch (error) {
            console.error('Failed to respond to request:', error)
            throw error
        }
    },

    proposeTime: async (sessionId: number, time: string) => {
        try {
            const response = await api.post(`sessions/${sessionId}/propose-time/`, { time })
            const updated = response.data
            set((state) => ({
                sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
                currentSession: state.currentSession?.id === sessionId ? updated : state.currentSession
            }))
            return updated
        } catch (error) {
            console.error('Failed to propose time:', error)
            throw error
        }
    },

    confirmTime: async (sessionId: number) => {
        try {
            const response = await api.post(`sessions/${sessionId}/confirm-time/`)
            const updated = response.data
            set((state) => ({
                sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
                currentSession: state.currentSession?.id === sessionId ? updated : state.currentSession
            }))
            return updated
        } catch (error) {
            console.error('Failed to confirm time:', error)
            throw error
        }
    },

    joinLobby: async (sessionId: number) => {
        try {
            const response = await api.post(`sessions/${sessionId}/join-lobby/`)
            const updated = response.data
            set((state) => ({
                sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
                currentSession: state.currentSession?.id === sessionId ? updated : state.currentSession
            }))
            return updated
        } catch (error) {
            console.error('Failed to join lobby:', error)
            throw error
        }
    },

    endSession: async (id: number) => {
        try {
            const response = await api.post(`sessions/${id}/end/`)
            const updated = response.data.session

            // Update local session state immediately
            set((state) => ({
                sessions: state.sessions.map((s) => s.id === id ? updated : s),
                currentSession: state.currentSession?.id === id ? updated : state.currentSession
            }))

            // Also re-fetch full sessions list to catch any server-side changes
            // (e.g., related post being marked as complete)
            api.get('sessions/').then((r) => {
                const sessions = Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
                set({ sessions })
            }).catch(() => {/* silently ignore background fetch error */})

            // Sync credits to authStore
            useAuthStore.getState().fetchProfile()

            return response.data
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } }
            set({ error: err.response?.data?.detail || 'Failed to end session' })
            throw error
        }
    },

    submitReview: async (sessionId: number, review: ReviewCreate) => {
        try {
            const response = await api.post(`sessions/${sessionId}/reviews/`, review)
            return response.data
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } }
            set({ error: err.response?.data?.detail || 'Failed to submit review' })
            throw error
        }
    },

    clearError: () => set({ error: null }),

    setCurrentSession: (session: Session | null) => set({ currentSession: session }),
}))
