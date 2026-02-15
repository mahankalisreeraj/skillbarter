import { useEffect, useRef, useCallback } from 'react'

interface PollingOptions {
    interval: number
    enabled?: boolean
    immediate?: boolean
}

export function usePolling(
    callback: () => Promise<void> | void,
    options: PollingOptions,
    deps: any[] = []
) {
    const { interval, enabled = true, immediate = true } = options
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const isRunningRef = useRef(false)

    const poll = useCallback(async () => {
        if (isRunningRef.current) return

        isRunningRef.current = true
        try {
            await callback()
        } catch (error) {
            console.error('Polling error:', error)
        } finally {
            isRunningRef.current = false
        }
    }, [callback, ...deps])

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            return
        }

        if (immediate) {
            poll()
        }

        timerRef.current = setInterval(poll, interval)

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [enabled, interval, immediate, poll])

    return {
        refetch: poll
    }
}
