import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import throttle from 'lodash.throttle'
import "@excalidraw/excalidraw/index.css"

// Using 'any' for these types to avoid complex path issues with Excalidraw's internal types
// while ensuring the component logic remains solid.
type ExcalidrawElement = any
type AppState = any

interface WhiteboardProps {
    sessionId: string
    isVisible: boolean
    onSendData: (data: unknown) => void
}

export default function Whiteboard({ sessionId, isVisible, onSendData }: WhiteboardProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
    const isImportingRef = useRef(false)
    const lastSceneRef = useRef<string>('')

    // Load initial state from localStorage
    const getInitialData = () => {
        const saved = localStorage.getItem(`whiteboard_excalidraw_${sessionId}`)
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.error('Failed to parse saved whiteboard state', e)
            }
        }
        return null
    }

    const [initialData] = useState(getInitialData)

    // Handle incoming updates from peers
    useEffect(() => {
        const handleWhiteboardEvent = (event: CustomEvent) => {
            console.log('DEBUG: Whiteboard Event Received', {
                hasAPI: !!excalidrawAPI,
                detail: event.detail
            })

            if (!excalidrawAPI) {
                console.warn('DEBUG: Excalidraw API not ready, ignoring event')
                return
            }
            const { data } = event.detail

            if (data.type === 'full_state') {
                console.log('DEBUG: Processing full_state update')
                // Backend already excludes the sender, so any message received is from a peer.
                // We ignore the 'source' field because the peer sending it sets it to 'local'.
                isImportingRef.current = true
                
                // FIX: Update lastSceneRef before updateScene triggers onChange
                if (data.elements && Array.isArray(data.elements)) {
                    const sceneVersion = data.elements.reduce((acc: number, el: any) => acc + (el.version || 0), 0)
                    lastSceneRef.current = `${data.elements.length}-${sceneVersion}`
                }

                excalidrawAPI.updateScene({
                    elements: data.elements,
                    appState: { ...data.appState },
                    commitToHistory: false,
                })
                // Also save to local storage
                localStorage.setItem(`whiteboard_excalidraw_${sessionId}`, JSON.stringify(data))

                // Reset importing flag after a short delay
                setTimeout(() => {
                    isImportingRef.current = false
                }, 100)
            } else {
                console.log('DEBUG: Unknown whiteboard event type:', data.type)
            }
        }

        window.addEventListener('whiteboard_update' as any, handleWhiteboardEvent as EventListener)
        return () => window.removeEventListener('whiteboard_update' as any, handleWhiteboardEvent as EventListener)
    }, [excalidrawAPI, sessionId])

    // Throttled broadcast function
    const broadcastChange = useMemo(() =>
        throttle((elements: readonly ExcalidrawElement[], appState: AppState) => {
            if (isImportingRef.current) return

            const sceneData = {
                elements,
                appState: {
                    theme: appState.theme,
                    viewBackgroundColor: appState.viewBackgroundColor
                },
                type: 'full_state'
            }

            // Persist locally
            localStorage.setItem(`whiteboard_excalidraw_${sessionId}`, JSON.stringify(sceneData))

            // Broadcast to peers
            onSendData({
                ...sceneData,
                source: 'local'
            })
        }, 300),
        [onSendData, sessionId])

    // Excalidraw onChange handler
    const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
        if (isImportingRef.current || !excalidrawAPI) return

        // Quick check for elements change to avoid unnecessary broadcasts
        const sceneVersion = elements.reduce((acc: number, el: any) => acc + (el.version || 0), 0)
        const sceneString = `${elements.length}-${sceneVersion}`
        
        if (sceneString === lastSceneRef.current) {
            // No actual element changes (just pointer/selection), don't broadcast
            return
        }
        lastSceneRef.current = sceneString

        broadcastChange(elements, appState)
    }, [excalidrawAPI, broadcastChange])


    return (
        <div className="h-full w-full bg-surface border-t border-primary/10 overflow-hidden">
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={onChange}
                theme="light"
                viewModeEnabled={false}
                zenModeEnabled={false}
                gridModeEnabled={false}
                UIOptions={{
                    canvasActions: {
                        toggleTheme: false,
                        export: false,
                        loadScene: false,
                        saveAsImage: true,
                        clearCanvas: true,
                    },
                }}
            />
        </div>
    )
}
