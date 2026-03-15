import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionSocket } from '@/hooks/useSessionSocket'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

// Session Components
import Whiteboard from '@/components/session/Whiteboard'
import VideoCall from '@/components/session/VideoCall'
import CodeEditor from '@/components/session/CodeEditor'
import SessionTimer from '@/components/session/SessionTimer'
import ReviewForm from '@/components/ReviewForm'

type LayoutMode = 'whiteboard' | 'video' | 'code'

interface ChatPanelProps {
    className?: string
    messages: Array<{ 
        sender: number; 
        sender_name: string; 
        message: string; 
        timestamp: string;
        file_name?: string;
        file_size?: number;
        file_url?: string;
    }>
    onSendMessage: (params: { message?: string; file?: File }) => void
    isConnected: boolean
}

function ChatPanel({ className, messages, onSendMessage, isConnected }: ChatPanelProps) {
    const [inputValue, setInputValue] = useState('')
    const { user } = useAuthStore()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])


    const formatTimestamp = (isoString?: string) => {
        if (!isoString) return ''
        const date = new Date(isoString)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return ''
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (inputValue.trim()) {
            onSendMessage({ message: inputValue })
            setInputValue('')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File is too large. Max size is 5MB.')
                return
            }
            onSendMessage({ file })
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const getFileIcon = (fileName?: string) => {
        if (!fileName) return '📄'
        const ext = fileName.split('.').pop()?.toLowerCase()
        if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext || '')) return '🖼️'
        if (ext === 'pdf') return '📕'
        if (['js', 'py', 'java', 'cpp', 'ts', 'html', 'css'].includes(ext || '')) return '💻'
        return '📄'
    }

    return (
        <div className={clsx('flex flex-col', className)}>
            <div className="p-3 border-b border-primary/10 flex items-center justify-between">
                <h3 className="font-semibold">Chat</h3>
                <span className={clsx(
                    'w-2 h-2 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                )} />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No messages yet</p>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.sender === user?.id
                        return (
                            <div
                                key={i}
                                className={clsx(
                                    'flex flex-col max-w-[85%]',
                                    isMe ? 'ml-auto items-end' : 'items-start'
                                )}
                            >
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{msg.sender_name}</span>
                                    <span className="text-[10px] text-slate-400">{formatTimestamp(msg.timestamp)}</span>
                                </div>
                                <div
                                    className={clsx(
                                        'px-3 py-2 rounded-2xl text-sm shadow-sm flex flex-col gap-1',
                                        isMe
                                            ? 'bg-primary text-white rounded-tr-none'
                                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                    )}
                                >
                                    {msg.file_url ? (
                                        <a 
                                            href={msg.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className={clsx(
                                                "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                                                isMe ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-white border-slate-200 hover:border-primary/30"
                                            )}
                                        >
                                            <span className="text-xl">{getFileIcon(msg.file_name)}</span>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium truncate max-w-[150px]">{msg.file_name}</span>
                                                <span className="text-[10px] opacity-70">{formatFileSize(msg.file_size)}</span>
                                            </div>
                                            <span className="ml-2">📥</span>
                                        </a>
                                    ) : null}
                                    {msg.message && <div>{msg.message}</div>}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t border-primary/10">
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!isConnected}
                        className="p-2 text-slate-500 hover:text-primary transition-colors hover:bg-primary/5 rounded-lg"
                        title="Attach file"
                    >
                        📎
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type a message..."
                        className="input flex-1 text-sm"
                        disabled={!isConnected}
                    />
                    <button
                        type="submit"
                        className="btn-primary px-4"
                        disabled={!isConnected || !inputValue.trim()}
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    )
}

export default function SessionPage() {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { fetchSession } = useSessionsStore()

    const sessionSocket = useSessionSocket(sessionId)
    const chatSocket = useChatSocket(sessionId)

    const [activeMode, setActiveMode] = useState<LayoutMode>('whiteboard')
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [isEnding, setIsEnding] = useState(false)

    // Resizing logic
    const [sidePanelWidth, setSidePanelWidth] = useState(350)
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    const stopResizing = useCallback(() => {
        setIsResizing(false)
    }, [])

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing && containerRef.current && window.innerWidth >= 1024) {
                const containerRect = containerRef.current.getBoundingClientRect()
                const newWidth = containerRect.right - e.clientX
                if (newWidth > 280 && newWidth < 600) {
                    setSidePanelWidth(newWidth)
                }
            }
        },
        [isResizing]
    )

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize)
            window.addEventListener('mouseup', stopResizing)
        } else {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
        return () => {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [isResizing, resize, stopResizing])

    useEffect(() => {
        const id = parseInt(sessionId || '')
        if (!isNaN(id)) {
            fetchSession(id)
        }
    }, [sessionId, fetchSession])

    // Show review modal when session ends
    useEffect(() => {
        if (sessionSocket.session && !sessionSocket.session.is_active && !showReviewModal) {
            setShowReviewModal(true)
        }
    }, [sessionSocket.session?.is_active, showReviewModal])

    const handleEndSession = async () => {
        setIsEnding(true)
        try {
            sessionSocket.endSession()
        } finally {
            setIsEnding(false)
        }
    }

    const handleLeaveSession = () => {
        navigate('/search')
    }

    if (!sessionId || sessionId === 'undefined' || !user) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
                <div className="text-center space-y-2">
                    <p className="text-slate-500 text-lg">Loading session or invalid session ID...</p>
                    <p className="text-xs text-slate-400 font-mono">
                        Debug: ID={sessionId || 'missing'}, User={user ? 'present' : 'missing'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/search')}
                    className="btn-primary"
                >
                    Back to Search
                </button>
            </div>
        )
    }

    const modes: { id: LayoutMode; label: string; icon: string }[] = [
        { id: 'whiteboard', label: 'Whiteboard', icon: '🎨' },
        { id: 'video', label: 'Video', icon: '📹' },
        { id: 'code', label: 'IDE', icon: '💻' },
    ]

    const peerName = sessionSocket.session
        ? (sessionSocket.session.user1 === user.id
            ? sessionSocket.session.user2_name
            : sessionSocket.session.user1_name)
        : 'Peer'

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 glass border-b border-white/10 gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="font-bold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                        Session with {peerName}
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className={clsx(
                            'w-2 h-2 rounded-full',
                            sessionSocket.isConnected ? 'bg-green-500' : 'bg-slate-300'
                        )} />
                        <span className="text-[10px] sm:text-sm text-slate-500">
                            {sessionSocket.isConnected ? 'Connected' : '...'}
                        </span>
                    </div>
                </div>

                {/* Mode Switcher - Optimized for Mobile */}
                <div className={clsx(
                    "flex items-center gap-1 p-1 bg-primary/5 rounded-lg transition-all overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none",
                    !sessionSocket.isPeerInRoom ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 translate-y-0"
                )}>
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setActiveMode(mode.id)}
                            className={clsx(
                                'px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap',
                                activeMode === mode.id
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-slate-500 hover:text-primary'
                            )}
                        >
                            <span className="sm:mr-2">{mode.icon}</span>
                            <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {sessionSocket.session?.is_active ? (
                        <button
                            onClick={handleEndSession}
                            disabled={isEnding}
                            className="btn-secondary text-xs sm:text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 sm:px-6 py-1.5"
                        >
                            {isEnding ? '...' : 'End'}
                        </button>
                    ) : (
                        <button
                            onClick={handleLeaveSession}
                            className="btn-secondary text-xs sm:text-sm px-3 sm:px-6 py-1.5"
                        >
                            Leave
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div ref={containerRef} className="flex-1 flex flex-col lg:flex-row gap-0 p-2 overflow-hidden relative min-h-0 w-full">
                {/* Primary Panel */}
                <div className="flex-1 lg:w-0 card !p-0 overflow-hidden min-w-0 flex flex-col h-[50vh] lg:h-full bg-surface-elevated relative shadow-xl">
                    {/* Waiting Indicator */}
                    <AnimatePresence>
                        {!sessionSocket.isPeerInRoom && sessionSocket.session?.is_active && (
                            <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 transition-all animate-fade-in">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="card max-w-sm w-full p-6 sm:p-8 text-center space-y-4 shadow-2xl border-primary/20 bg-surface/90"
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-2xl sm:text-3xl animate-pulse">
                                            ⏳
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">Waiting for {peerName}</h3>
                                        <p className="text-slate-500 text-xs sm:text-sm mt-2">
                                            They'll be here soon!
                                        </p>
                                    </div>
                                    <div className="flex gap-2 items-center justify-center text-[10px] sm:text-xs text-primary font-medium bg-primary/5 py-1.5 px-3 rounded-full w-fit mx-auto">
                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                                        Monitoring room...
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                    <div className={clsx('h-full w-full relative', activeMode !== 'whiteboard' && 'hidden')}>
                        <Whiteboard
                            sessionId={sessionId}
                            isVisible={activeMode === 'whiteboard'}
                            onSendData={sessionSocket.sendWhiteboard}
                        />
                    </div>

                    <div className={clsx('h-full w-full relative bg-black', activeMode !== 'video' && 'hidden')}>
                        {sessionSocket.session && (
                            <VideoCall
                                sessionId={sessionId ?? ''}
                                onSignal={sessionSocket.sendMessage}
                                isConnected={sessionSocket.isConnected}
                                isCaller={user?.id === sessionSocket.session?.user1}
                            />
                        )}
                    </div>

                    <div className={clsx('h-full w-full relative', activeMode !== 'code' && 'hidden')}>
                        <CodeEditor
                            sessionId={sessionId ?? ''}
                            isVisible={activeMode === 'code'}
                            onCodeChange={sessionSocket.sendCode}
                        />
                    </div>
                </div>

                {/* Resizer Handle - Visible only on Desktop */}
                <div
                    onMouseDown={startResizing}
                    className={clsx(
                        'hidden lg:flex w-3 cursor-col-resize flex-shrink-0 group relative z-10',
                        isResizing && 'bg-primary/20'
                    )}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-primary transition-colors h-full" />
                </div>

                {/* Right Panel - Chat and Stats */}
                <div
                    style={{ width: window.innerWidth >= 1024 ? `${sidePanelWidth}px` : '100%' }}
                    className="flex flex-col gap-3 sm:gap-4 flex-shrink-0 min-w-0 lg:min-w-[280px] h-[50vh] lg:h-full overflow-hidden mt-3 lg:mt-0"
                >
                    {/* Timer - Only visible/active when peer is in room */}
                    <div className={clsx(
                        "transition-all duration-500",
                        !sessionSocket.isPeerInRoom ? "opacity-40 grayscale pointer-events-none scale-95" : "opacity-100 grayscale-0 scale-100"
                    )}>
                        <SessionTimer
                            activeTimer={sessionSocket.activeTimer}
                            onStartTimer={sessionSocket.startTimer}
                            onStopTimer={sessionSocket.stopTimer}
                            yourCredits={sessionSocket.yourCredits}
                            isSessionActive={!!sessionSocket.session?.is_active && sessionSocket.isPeerInRoom}
                            accumulatedSeconds={
                                sessionSocket.session
                                    ? (sessionSocket.activeTimer?.is_running
                                        ? (sessionSocket.activeTimer?.teacher === sessionSocket.session?.user1
                                            ? sessionSocket.session?.user1_teaching_time
                                            : sessionSocket.session?.user2_teaching_time)
                                        : (user?.id === sessionSocket.session?.user1
                                            ? sessionSocket.session?.user1_teaching_time
                                            : sessionSocket.session?.user2_teaching_time))
                                    : 0
                            }
                        />
                        {!sessionSocket.isPeerInRoom && (
                            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium animate-pulse">
                                Waiting for both users to start timer
                            </p>
                        )}
                    </div>

                    {/* Chat - Flex 1 to take remaining height */}
                    <ChatPanel
                        className="flex-1 card !p-0 overflow-hidden flex flex-col min-h-0"
                        messages={chatSocket.messages}
                        onSendMessage={chatSocket.sendMessage}
                        isConnected={chatSocket.isConnected}
                    />
                </div>
            </div>

            {/* Review Modal */}
            {
                showReviewModal && sessionSocket.session && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
                        <div className="card max-w-md w-full mx-4">
                            <h2 className="text-xl font-bold mb-4">Session Ended</h2>
                            <p className="text-slate-500 mb-6">
                                Your session with {peerName} has ended.
                                Would you like to leave a review?
                            </p>

                            <ReviewForm
                                sessionId={parseInt(sessionId || '0')}
                                onComplete={() => {
                                    setShowReviewModal(false)
                                    navigate('/search')
                                }}
                                onSkip={() => {
                                    setShowReviewModal(false)
                                    navigate('/search')
                                }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Error Toast */}
            {
                sessionSocket.error && (
                    <div className="fixed bottom-4 right-4 p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 animate-slide-up">
                        {sessionSocket.error}
                    </div>
                )
            }
        </div >
    )
}
