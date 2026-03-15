import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

// Helper to format scheduled date
const formatScheduledTime = (time: string | null) => {
    if (!time) return 'TBD'
    return new Date(time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SessionsPage() {
    const { sessions, isLoading, error, fetchSessions } = useSessionsStore()
    const { user } = useAuthStore()

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

    const incomingRequests = sessions.filter(s => s.status === 'pending' && s.user1 === user?.id)
    const sentRequests = sessions.filter(s => s.status === 'pending' && s.user2 === user?.id)
    const scheduledSessions = sessions.filter(s => s.status === 'scheduled' || s.status === 'accepted')
    const activeSessions = sessions.filter(s => s.status === 'active')
    const pastSessions = sessions.filter(s => ['completed', 'expired', 'rejected'].includes(s.status)).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Session Hub</h1>
                    <p className="text-slate-500 text-sm">Manage your learning and teaching schedule</p>
                </div>
                <Link to="/search" className="btn-primary">
                    Find New Session
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full" />
                        Requests to Teach You ({incomingRequests.length})
                    </h2>
                    <div className="grid gap-4">
                        {incomingRequests.map(session => (
                            <SessionCard 
                                key={session.id} 
                                session={session} 
                                user={user} 
                                type="incoming"
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-700">My Sent Requests ({sentRequests.length})</h2>
                    <div className="grid gap-4 opacity-80">
                        {sentRequests.map(session => (
                            <SessionCard 
                                key={session.id} 
                                session={session} 
                                user={user} 
                                type="sent"
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Scheduled / Active */}
            <section className="space-y-4">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Upcoming & Active
                </h2>
                {[...activeSessions, ...scheduledSessions].length === 0 ? (
                    <div className="card text-center py-12 text-slate-500 bg-slate-50/50">
                        <p className="text-xl mb-2">📅</p>
                        <p>No upcoming sessions scheduled.</p>
                        <Link to="/search" className="text-primary hover:underline mt-2 inline-block">
                            Browse requests →
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {[...activeSessions, ...scheduledSessions].map(session => (
                            <SessionCard 
                                key={session.id} 
                                session={session} 
                                user={user} 
                                type="scheduled"
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Past Sessions */}
            {pastSessions.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-700">Past History</h2>
                    <div className="space-y-2">
                        {pastSessions.map(session => (
                            <div key={session.id} className="card p-4 flex items-center justify-between opacity-70 grayscale-[0.5]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold">
                                        {(session.user1 === user?.id ? session.user2_name : session.user1_name)?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            {session.user1 === user?.id ? session.user2_name : session.user1_name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(session.start_time).toLocaleDateString()} • {session.status}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400">
                                        {(session.user1_teaching_time + session.user2_teaching_time) > 0 
                                            ? `${Math.floor((session.user1_teaching_time + session.user2_teaching_time)/60)}m taught` 
                                            : 'No time recorded'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}

// Sub-component for session items
function SessionCard({ session, user, type }: { session: any, user: any, type: string }) {
    const { respondToRequest, proposeTime, confirmTime } = useSessionsStore()
    const [isProposing, setIsProposing] = useState(false)
    const [proposalTime, setProposalTime] = useState('')

    const peerName = session.user1 === user?.id ? session.user2_name : session.user1_name
    const isLearner = session.user1 === user?.id

    const handleRespond = (decision: 'accept' | 'reject') => respondToRequest(session.id, decision)
    const handlePropose = async () => {
        if (!proposalTime) return
        await proposeTime(session.id, new Date(proposalTime).toISOString())
        setIsProposing(false)
    }

    return (
        <div className={clsx(
            "card relative overflow-hidden transition-all",
            session.status === 'active' ? "border-primary ring-1 ring-primary/20" : ""
        )}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-xl font-bold border border-primary/10">
                        {peerName?.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900">{peerName}</h3>
                            <span className={clsx(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                                isLearner ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                            )}>
                                {isLearner ? 'Your Teacher' : 'Your Learner'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                            Status: <span className="font-semibold text-slate-700 capitalize">{session.status}</span>
                            {session.scheduled_time && ` • ${formatScheduledTime(session.scheduled_time)}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                    {type === 'incoming' && (
                        <>
                            <button onClick={() => handleRespond('reject')} className="btn-secondary py-2 text-sm text-red-500 border-red-100 hover:bg-red-50">Decline</button>
                            <button onClick={() => handleRespond('accept')} className="btn-primary py-2 text-sm">Accept to Schedule</button>
                        </>
                    )}

                    {session.status === 'accepted' && (
                        <div className="flex flex-col items-end gap-2">
                            {session.proposed_time ? (
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Proposed: <span className="font-bold">{new Date(session.proposed_time).toLocaleString()}</span></p>
                                    {session.proposer !== user?.id ? (
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => setIsProposing(true)} className="text-xs font-bold text-primary">Suggest Other</button>
                                            <button onClick={() => confirmTime(session.id)} className="btn-primary py-1 px-4 text-xs">Confirm Time</button>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-amber-600 font-bold italic mt-1">Waiting for their confirmation...</p>
                                    )}
                                </div>
                            ) : (
                                <button onClick={() => setIsProposing(true)} className="btn-primary py-2 text-sm bg-accent hover:bg-accent-dark">Set Meeting Time</button>
                            )}
                        </div>
                    )}

                    {(session.status === 'scheduled' || session.status === 'active') && (
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Starts in</p>
                                <p className="text-sm font-black text-primary">
                                    {session.status === 'active' ? 'NOW' : 'Soon'}
                                </p>
                            </div>
                            <Link to={`/session/${session.id}`} className="btn-primary px-8 shadow-xl">
                                {session.status === 'active' ? 'Enter Classroom' : 'Go to Lobby'}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {isProposing && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-4 duration-300">
                    <p className="text-sm font-bold text-slate-700 mb-3">When should you meet?</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            type="datetime-local" 
                            className="input flex-1" 
                            value={proposalTime}
                            onChange={(e) => setProposalTime(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setIsProposing(false)} className="btn-secondary py-2">Cancel</button>
                            <button onClick={handlePropose} className="btn-primary py-2">Propose This Time</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Warning for penalties */}
            {session.status === 'accepted' || session.status === 'scheduled' && (
                <div className="mt-4 pt-4 border-t border-slate-100/50 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="text-xs">⚠️</span>
                    <span>Note: Missing a scheduled session results in a <strong>1 credit penalty</strong>. Both lose credits if no one shows up.</span>
                </div>
            )}
        </div>
    )
}
