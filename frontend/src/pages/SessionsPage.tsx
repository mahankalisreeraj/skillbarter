import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'
import clsx from 'clsx'

export default function SessionsPage() {
    const { sessions, isLoading, error, fetchSessions } = useSessionsStore()
    const { user } = useAuthStore()
    const { isUserOnline } = usePresenceStore()

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500">Loading sessions...</p>
                </div>
            </div>
        )
    }

    const activeSessions = sessions.filter(s => s.is_active)
    const pastSessions = sessions.filter(s => !s.is_active).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Sessions</h1>
                <Link to="/search" className="btn-primary">
                    Find New Session
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Active Sessions */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Active Sessions ({activeSessions.length})
                </h2>

                {activeSessions.length === 0 ? (
                    <div className="card text-center py-8 text-slate-500">
                        <p className="text-xl mb-2">🔍</p>
                        <p>No active sessions</p>
                        <Link to="/search" className="text-primary hover:underline mt-2 inline-block">
                            Start learning →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeSessions.map((session, index) => {
                            const peerName = session.user1 === user?.id
                                ? session.user2_name
                                : session.user1_name
                            const peerId = session.user1 === user?.id
                                ? session.user2
                                : session.user1
                            const isOnline = isUserOnline(peerId)

                            return (
                                <div key={session.id || `active-${index}`} className="flex flex-col gap-2 relative group">
                                    <div className={clsx(
                                        "card transition-all flex items-center justify-between",
                                        isOnline
                                            ? "hover:border-primary/50 cursor-pointer"
                                            : "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-transform group-hover:scale-105",
                                                isOnline ? "bg-gradient-to-br from-primary to-accent" : "bg-slate-300"
                                            )}>
                                                {peerName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-slate-900">Session with {peerName}</p>
                                                    <span className={clsx(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        isOnline ? "bg-green-500 animate-pulse" : "bg-slate-400"
                                                    )} title={isOnline ? "Online" : "Offline"} />
                                                </div>
                                                <p className="text-sm text-slate-500">
                                                    Started {new Date(session.start_time).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className={clsx(
                                                "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider",
                                                isOnline ? "bg-green-500/20 text-green-600" : "bg-slate-200 text-slate-500"
                                            )}>
                                                {isOnline ? 'Joinable' : 'Peer Offline'}
                                            </span>

                                            {isOnline ? (
                                                <Link
                                                    to={`/session/${session.id}`}
                                                    className="btn-primary py-1.5 px-6 text-sm shadow-md hover:shadow-lg transition-all"
                                                >
                                                    Enter Room
                                                </Link>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-medium">Wait for peer to go online</span>
                                            )}
                                        </div>
                                    </div>
                                    <Link
                                        to={`/user/${peerId}`}
                                        className="text-xs text-slate-600 hover:text-primary transition-colors ml-16"
                                    >
                                        View {peerName}'s Profile →
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Past Sessions */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">
                    Past Sessions ({pastSessions.length})
                </h2>

                {pastSessions.length === 0 ? (
                    <div className="card text-center py-8 text-slate-500">
                        <p>No past sessions yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pastSessions.map((session, index) => {
                            const peerName = session.user1 === user?.id
                                ? session.user2_name
                                : session.user1_name
                            const peerId = session.user1 === user?.id
                                ? session.user2
                                : session.user1
                            return (
                                <div key={session.id || `past-${index}`} className="flex flex-col gap-2">
                                    <div
                                        className="card flex items-center justify-between opacity-75"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500">
                                                {peerName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium">Session with {peerName}</p>
                                                <p className="text-sm text-slate-500">
                                                    {new Date(session.start_time).toLocaleDateString()} •
                                                    {session.end_time && ` Ended ${new Date(session.end_time).toLocaleTimeString()}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 text-sm rounded-full">
                                            Ended
                                        </span>
                                    </div>
                                    <Link
                                        to={`/user/${peerId}`}
                                        className="text-xs text-slate-600 hover:text-primary transition-colors ml-16"
                                    >
                                        View {peerName}'s Profile →
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
