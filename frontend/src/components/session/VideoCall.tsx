import { useEffect, useRef, useState, useCallback } from 'react'
import clsx from 'clsx'

interface VideoCallProps {
    sessionId: string
    onSignal: (type: string, payload: any) => void
    isConnected: boolean
    isCaller: boolean
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
}

export default function VideoCall({ sessionId, onSignal, isConnected, isCaller }: VideoCallProps) {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [isSharingScreen, setIsSharingScreen] = useState(false)
    const [isMuted, setIsMuted] = useState(() => {
        const stored = sessionStorage.getItem(`session_media_${sessionId}_muted`)
        return stored !== null ? stored === 'true' : false
    })
    const [isVideoOff, setIsVideoOff] = useState(() => {
        const stored = sessionStorage.getItem(`session_media_${sessionId}_video_off`)
        return stored !== null ? stored === 'true' : true
    })


    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const peerRef = useRef<RTCPeerConnection | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)

    // Helper to send signals
    const sendSignal = useCallback((type: string, data: any) => {
        if (isConnected) {
            onSignal(type, data)
        }
    }, [onSignal, isConnected])

    // Initialize WebRTC
    useEffect(() => {
        if (!isConnected) return

        let mounted = true
        let stream: MediaStream | null = null

        const init = async () => {
            try {
                // Determine constraints based on user preferences
                const constraints = {
                    audio: true, // Always request audio, handle mute via tracks
                    video: !isVideoOff // Only request video if not turned off
                }

                if (!isVideoOff) {
                    stream = await navigator.mediaDevices.getUserMedia(constraints)
                } else {
                    // If video is off, get only audio
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                }

                if (!mounted) {
                    stream?.getTracks().forEach(t => t.stop())
                    return
                }

                setLocalStream(stream)

                // Apply initial mute state
                stream.getAudioTracks().forEach(track => track.enabled = !isMuted)

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream
                    localVideoRef.current.muted = true // Always mute local video playback
                }

                const pc = new RTCPeerConnection(ICE_SERVERS)
                peerRef.current = pc

                // Add Tracks
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream!)
                })

                // Handle ICE Candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        sendSignal('candidate', { candidate: event.candidate })
                    }
                }

                // Handle Connection State
                pc.onconnectionstatechange = () => {
                    // State monitoring
                }

                // Handle Remote Stream
                pc.ontrack = (event) => {
                    if (mounted) {
                        setRemoteStream(event.streams[0])
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = event.streams[0]
                        }
                    }
                }

                // Announce ready
                setTimeout(() => {
                    sendSignal('ready', {})
                }, 500)

            } catch (err) {
                console.error('Failed to access media devices', err)
            }
        }

        init()

        return () => {
            mounted = false
            // stop all tracks
            stream?.getTracks().forEach(t => t.stop())
            localStream?.getTracks().forEach(t => t.stop())
            screenStreamRef.current?.getTracks().forEach(t => t.stop())
            peerRef.current?.close()
            peerRef.current = null
        }
    }, [isConnected, isVideoOff])


    // Handle incoming signals
    useEffect(() => {
        const handleSignal = async (e: any) => {
            const payload = e.detail
            const pc = peerRef.current

            if (!pc) return

            try {
                if (payload.type === 'ready') {
                    // "Ready" means the other peer is online.
                    if (isCaller) {
                        // As Caller, we initiate the offer when we see the other peer is ready.
                        // Check if we are already negotiating to avoid glare or reset
                        if (pc.signalingState === 'stable') {
                            console.log('DEBUG: Caller creating Offer (Auto Reconnect)')

                            // If we already have a remote description, we might need to reset or just re-offer
                            // WebRTC handles renegotiation via createOffer on existing connection
                            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                            await pc.setLocalDescription(offer)
                            sendSignal('offer', { sdp: offer })
                        }
                    } else {
                        // As Callee, if we receive 'ready', it means the Caller just joined (or re-joined).
                        // We MUST announce ourselves again so the Caller knows WE are ready too.
                        // Even if we think we have a stream, the Caller's 'ready' signal implies a fresh start.
                        if (pc.signalingState === 'stable') {
                            console.log('DEBUG: Callee echoing ready (Auto Reconnect)')
                            // Force send 'ready' to trigger the caller
                            sendSignal('ready', {})
                        }
                    }
                } else if (payload.type === 'offer') {
                    // Handle Offer
                    // If we are Caller and receive offer, it's a glare or role confusion. 
                    // Strict roles: Caller should ideally ignore, but WebRTC requires handling.
                    // However, if Callee behaves correctly, Caller won't receive offer.

                    console.log('DEBUG: Received Offer')
                    if (pc.signalingState !== 'stable') {
                        console.log('DEBUG: Rolling back local description')
                        await pc.setLocalDescription({ type: 'rollback' })
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

                    console.log('DEBUG: Creating Answer')
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    sendSignal('answer', { sdp: answer })

                } else if (payload.type === 'answer') {
                    // Handle Answer
                    console.log('DEBUG: Received Answer')
                    if (pc.signalingState === 'have-local-offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    } else {
                        console.warn('DEBUG: Received answer in wrong state:', pc.signalingState)
                    }

                } else if (payload.type === 'candidate') {
                    // Handle Candidate
                    if (payload.candidate) {
                        console.log('DEBUG: Received ICE Candidate')
                        // We must have a remote description before adding candidates
                        if (pc.remoteDescription) {
                            try {
                                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
                            } catch (e) {
                                console.error('Error adding ICE candidate', e)
                            }
                        } else {
                            console.log('DEBUG: Buffering candidate (remote description not set)')
                        }
                    }
                }
            } catch (err) {
                console.error('Signaling error:', err)
            }
        }

        window.addEventListener('signal' as any, handleSignal)
        return () => window.removeEventListener('signal' as any, handleSignal)
    }, [sendSignal, isCaller])


    const toggleMute = () => {
        if (localStream) {
            const newMuted = !isMuted
            localStream.getAudioTracks().forEach(track => track.enabled = !newMuted)
            setIsMuted(newMuted)
            sessionStorage.setItem(`session_media_${sessionId}_muted`, String(newMuted))
        }
    }

    // Sync remote stream to video element when it becomes available
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

    const toggleVideo = async () => {
        const newVideoOff = !isVideoOff
        setIsVideoOff(newVideoOff)
        sessionStorage.setItem(`session_media_${sessionId}_video_off`, String(newVideoOff))

        if (localStream) {
            const videoTracks = localStream.getVideoTracks()
            if (newVideoOff) {
                videoTracks.forEach(track => {
                    track.stop()
                    localStream.removeTrack(track)
                })
            } else {
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
                    const videoTrack = videoStream.getVideoTracks()[0]
                    localStream.addTrack(videoTrack)
                    if (peerRef.current) {
                        const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video')
                        if (sender) {
                            sender.replaceTrack(videoTrack)
                        } else {
                            peerRef.current.addTrack(videoTrack, localStream)
                        }
                    }
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStream
                    }
                } catch (e) {
                    console.error("Failed to restart video", e)
                    setIsVideoOff(true)
                }
            }
        }
    }

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
            const screenTrack = stream.getVideoTracks()[0]
            screenStreamRef.current = stream

            if (peerRef.current) {
                const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video')
                if (sender) {
                    await sender.replaceTrack(screenTrack)
                }
            }

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }

            screenTrack.onended = () => {
                stopScreenShare()
            }

            setIsSharingScreen(true)
        } catch (err) {
            console.error("Failed to share screen", err)
        }
    }

    const stopScreenShare = async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop())
            screenStreamRef.current = null
        }

        if (localStream && peerRef.current) {
            const videoTrack = localStream.getVideoTracks()[0]
            const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video')
            if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack)
            }
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStream
            }
        }
        setIsSharingScreen(false)
    }

    const toggleFullScreen = (element: HTMLDivElement | null) => {
        if (!element) return
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`)
            })
        } else {
            document.exitFullscreen()
        }
    }

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group">
            {/* Main Video Area */}
            {remoteStream ? (
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={clsx(
                        "w-full h-full transition-all duration-500",
                        isSharingScreen ? "object-contain" : "object-cover"
                    )}
                />
            ) : (
                <div className="text-slate-500 flex flex-col items-center z-10">
                    <span className="text-4xl mb-2 animate-pulse">👤</span>
                    <span>Waiting for partner...</span>
                </div>
            )}

            {/* Local Video PiP / Overlay */}
            <div className={clsx(
                "absolute transition-all duration-500 ease-in-out border border-white/10 overflow-hidden shadow-2xl z-20 group-hover:opacity-100",
                isSharingScreen 
                    ? "bottom-24 right-6 w-64 h-48 rounded-2xl ring-4 ring-primary/20" 
                    : "top-4 right-4 w-32 h-24 md:w-48 md:h-36 rounded-lg opacity-80"
            )}>
                {!isVideoOff ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror-mode"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface text-slate-400 text-xs">
                        Video Off
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 z-30 shadow-2xl opacity-40 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                <button
                    onClick={toggleMute}
                    className={clsx(
                        "p-3 rounded-xl transition-all",
                        isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                    onClick={toggleVideo}
                    className={clsx(
                        "p-3 rounded-xl transition-all",
                        isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    title={isVideoOff ? "Start Camera" : "Stop Camera"}
                >
                    {isVideoOff ? '🚫' : '📹'}
                </button>
                
                <div className="w-px h-6 bg-white/10 mx-1" />

                <button
                    onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                    className={clsx(
                        "p-3 rounded-xl transition-all flex items-center gap-2",
                        isSharingScreen ? "bg-primary text-white" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    title={isSharingScreen ? "Stop Sharing" : "Share Screen"}
                >
                    <span className="text-lg">🖥️</span>
                    {isSharingScreen && <span className="text-xs font-bold uppercase tracking-wider pr-1">Sharing</span>}
                </button>

                <button
                    onClick={() => toggleFullScreen(containerRef.current)}
                    className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                    title="Toggle Full Screen"
                >
                    <span className="text-lg">🔲</span>
                </button>

                <div className="w-px h-6 bg-white/10 mx-1" />

                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('end_session'))}
                    className="p-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                    title="Leave Room"
                >
                    <span className="text-lg">🚪</span>
                </button>
            </div>

            {/* Sharing Indicator Banner */}
            {isSharingScreen && (
                <div className="absolute top-0 left-0 w-full bg-primary/90 text-white text-[10px] font-bold uppercase tracking-[0.2em] py-1 text-center z-30 animate-pulse">
                    Currently Sharing Your Screen
                </div>
            )}

            <style>{`
                .mirror-mode {
                    transform: scaleX(-1);
                }
            `}</style>
        </div>
    )
}
