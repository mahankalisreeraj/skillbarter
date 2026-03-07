import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { usePresence } from '@/hooks/usePresence'
import { usePresenceStore } from '@/stores/presenceStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Layout() {
    // Connect to presence WebSocket to mark user as online
    usePresence()
    const location = useLocation()
    const isSessionPage = location.pathname.startsWith('/session/')
    const { waitingSessions } = usePresenceStore()

    return (
        <div className="flex min-h-screen bg-surface-dark">
            {/* Global Peer Waiting Notifications */}
            <div className="fixed bottom-6 right-6 z-[100] space-y-3 pointer-events-none">
                <AnimatePresence>
                    {!isSessionPage && waitingSessions.map(session => (
                        <motion.div
                            key={session.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.9 }}
                            className="max-w-sm w-80 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 bg-slate-900/95 backdrop-blur-2xl pointer-events-auto flex items-center gap-4 border-l-4 border-l-accent relative overflow-hidden group"
                        >
                            {/* Animated background glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-2xl shadow-inner relative z-10"
                            >
                                👋
                            </motion.div>

                            <div className="flex-1 min-w-0 relative z-10">
                                <p className="text-sm font-black text-white uppercase tracking-tight truncate">
                                    {session.peer_name} is waiting!
                                </p>
                                <p className="text-xs text-slate-300 font-medium">Join them in your session.</p>
                            </div>

                            <Link
                                to={`/session/${session.id}`}
                                className="bg-accent hover:bg-accent-dark text-black text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] transition-all hover:scale-105 active:scale-95 relative z-10"
                            >
                                Join
                            </Link>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Always-visible Bank Sidebar (unless in session) */}
            {!isSessionPage && <Sidebar />}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col ${isSessionPage ? '' : 'ml-72'}`}>
                <Header />
                <main className="flex-1 p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
