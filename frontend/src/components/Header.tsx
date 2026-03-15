import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePostsStore } from '@/stores/requestsStore'
import { useState, useEffect } from 'react'
import AvailabilityModal from './AvailabilityModal'
import { useUIStore } from '@/stores/uiStore'
import { motion } from 'framer-motion'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuthStore()
    const { myPosts } = usePostsStore()
    const { toggleSidebar } = useUIStore()
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [searchValue, setSearchValue] = useState('')

    // Sync search input with URL
    useEffect(() => {
        setSearchValue(searchParams.get('q') || '')
    }, [searchParams])

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchValue(value)
        if (value.trim()) {
            navigate(`/search?q=${encodeURIComponent(value)}`)
        } else {
            navigate('/search')
        }
    }

    const handleLogoutClick = () => {
        // Check if user has active posts
        const hasActivePosts = myPosts.some(p => !p.is_completed)

        if (hasActivePosts) {
            setShowAvailabilityModal(true)
        } else {
            logout()
        }
    }

    return (
        <>
            <motion.header
                initial={{ y: -64 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="h-16 bg-surface/50 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-40"
            >
                {/* Logo & Toggle */}
                <div className="flex items-center gap-3">
                    {isAuthenticated && (
                        <button
                            onClick={toggleSidebar}
                            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-primary transition-colors"
                            aria-label="Toggle navigation"
                        >
                            <span className="text-xl">☰</span>
                        </button>
                    )}

                    <Link to="/" className="flex items-center gap-2 group">
                        <motion.span
                            whileHover={{ rotate: 15, scale: 1.1 }}
                            className="text-2xl"
                        >
                            🔗
                        </motion.span>
                        <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent hidden md:block">
                            Link & Learn
                        </span>
                    </Link>
                </div>

                {/* Desktop Search */}
                {isAuthenticated && (
                    <div className="hidden sm:block relative flex-1 max-w-md mx-8">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchValue}
                            className="bg-white/50 border border-primary/20 rounded-full py-1.5 px-4 pl-9 text-sm w-full transition-all focus:bg-white focus:border-primary/50 outline-none text-slate-800 placeholder-slate-400"
                            onChange={handleSearch}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                )}

                {/* User Actions */}
                <nav className="flex items-center gap-4" role="navigation" aria-label="User menu">
                    {isAuthenticated ? (
                        <>
                            {/* Streak & Credits Display */}
                            {user && (
                                <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                                    {/* Streak Indicator */}
                                    <div className="flex items-center gap-1 group relative cursor-help" title={`Current login streak: ${user.login_streak} days`}>
                                        <span className={user.login_streak > 0 ? "text-orange-500 animate-pulse" : "text-slate-400 grayscale"}>🔥</span>
                                        <span className={`font-bold ${user.login_streak > 0 ? "text-orange-600" : "text-slate-500"}`}>{user.login_streak}</span>
                                    </div>
                                    
                                    <div className="w-px h-4 bg-primary/20"></div>

                                    {/* Credits */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-yellow-400">💰</span>
                                        <span className="font-medium text-primary">{Number(user.credits).toFixed(2)}</span>
                                        <span className="text-slate-500 text-sm hidden md:inline">credits</span>
                                    </div>
                                </div>
                            )}

                            <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-sm font-bold text-white">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-slate-600 hidden sm:block">
                                    {user?.name}
                                </span>
                            </Link>


                            <button
                                onClick={handleLogoutClick}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                aria-label="Logout"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="px-4 py-2 text-sm text-slate-600 hover:text-primary transition-colors"
                            >
                                Login
                            </Link>
                            <Link
                                to="/signup"
                                className="btn-primary text-sm"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </nav>
            </motion.header>

            <AvailabilityModal
                isOpen={showAvailabilityModal}
                onClose={() => setShowAvailabilityModal(false)}
                onConfirm={() => {
                    setShowAvailabilityModal(false)
                    logout()
                }}
            />
        </>
    )
}
