import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'
import { usePolling } from './usePolling'
import api from '@/lib/api'

const POLL_INTERVAL = 30000 // 30 seconds

export function usePresence() {
    const [isConnected, setIsConnected] = useState(false)
    const { accessToken, isAuthenticated } = useAuthStore()
    const { setOnlineUsers } = usePresenceStore()

    const fetchPresence = useCallback(async () => {
        if (!accessToken || !isAuthenticated) return

        try {
            const response = await api.get('/presence/online/')
            setOnlineUsers(response.data.users || [])
            setIsConnected(true)
        } catch (error) {
            console.error('Failed to fetch presence:', error)
            setIsConnected(false)
        }
    }, [accessToken, isAuthenticated, setOnlineUsers])

    usePolling(fetchPresence, {
        interval: POLL_INTERVAL,
        enabled: !!accessToken && isAuthenticated,
        immediate: true
    }, [fetchPresence])

    const reconnect = useCallback(async () => {
        await fetchPresence()
    }, [fetchPresence])

    return {
        isConnected, // Now represents 'isPollingActive/Healthy'
        reconnect,
    }
}
