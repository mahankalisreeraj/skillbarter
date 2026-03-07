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
                            className="card max-w-sm p-4 shadow-2xl border-primary/30 bg-white/90 backdrop-blur-xl pointer-events-auto flex items-center gap-4 border-l-4 border-l-primary"
                        >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                                👋
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                    {session.peer_name} is waiting!
                                </p>
                                <p className="text-xs text-slate-500">Join them in your session.</p>
                            </div>
                            <Link
                                to={`/session/${session.id}`}
                                className="btn-primary text-xs px-3 py-2 whitespace-nowrap"
                            >
                                Join Now
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
