import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { usePostsStore } from '@/stores/requestsStore'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'
import api from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { LearningPost } from '@/types'

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
} as const

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: "easeOut" }
    }
} as const

// Simple User Interface
interface SearchedUser {
    id: number
    name: string
    is_online: boolean
    availability?: string
    average_rating: number | null
}

export default function SearchPage() {
    const [topicLearn, setTopicLearn] = useState('')
    const [topicTeach, setTopicTeach] = useState('')
    const [okWithJustLearning, setOkWithJustLearning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showMyPosts, setShowMyPosts] = useState(false)
    const [connectingPostId, setConnectingPostId] = useState<number | null>(null)
    const [relevanceFilter, setRelevanceFilter] = useState<{ learn: string; teach: string } | null>(null)
    const [offlinePeer, setOfflinePeer] = useState<{ name: string; availability: string } | null>(null)

    // User search state
    const [searchParams] = useSearchParams()
    const searchQuery = searchParams.get('q') || ''
    const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
    const [isSearchingUsers, setIsSearchingUsers] = useState(false)

    const { posts, myPosts, isLoading, error, fetchPosts, fetchMyPosts, createPost, markCompleted, clearError } = usePostsStore()
    const { createSession } = useSessionsStore()
    const { user } = useAuthStore()
    const { isUserOnline } = usePresenceStore()
    const navigate = useNavigate()

    useEffect(() => {
        fetchPosts()
        fetchMyPosts()
    }, [fetchPosts, fetchMyPosts])

    // Fetch users when search query changes
    useEffect(() => {
        const fetchUsers = async () => {
            console.log('SearchPage: search query changed:', searchQuery)
            if (!searchQuery.trim()) {
                setSearchedUsers([])
                return
            }
            setIsSearchingUsers(true)
            try {
                const url = `/users/?search=${encodeURIComponent(searchQuery)}`
                console.log('SearchPage: fetching users from:', url)
                const response = await api.get(url)
                console.log('SearchPage: user search response:', response.data)
                setSearchedUsers(response.data)
            } catch (err) {
                console.error("Failed to search users", err)
            } finally {
                setIsSearchingUsers(false)
            }
        }
        fetchUsers()
    }, [searchQuery])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!topicLearn.trim()) return

        setIsSubmitting(true)
        clearError()
        try {
            await createPost(topicLearn, topicTeach, okWithJustLearning)
            // Set relevance filter to show matching posts
            setRelevanceFilter({ learn: topicLearn.trim(), teach: topicTeach.trim() })
            setShowMyPosts(false)
            setTopicLearn('')
            setTopicTeach('')
            setOkWithJustLearning(false)
            // Refresh posts to get latest
            fetchPosts()
        } catch (err: unknown) {
            const error = err as { response?: { data?: Record<string, string | string[]> } }
            const data = error.response?.data
            if (data) {
                const messages: string[] = []
                for (const val of Object.values(data)) {
                    if (Array.isArray(val)) messages.push(val[0])
                    else if (typeof val === 'string') messages.push(val)
                }
                // Use the store's error or set a custom one
                if (messages.length > 0) {
                    // We need to surface this - use clearError + throw pattern
                }
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleConnect = async (post: LearningPost) => {
        if (!user) return

        setConnectingPostId(post.id)
        try {
            await createSession(post.creator_id, post.id)
            // Redirect to sessions page to see the pending request
            navigate('/sessions')
        } catch (error) {
            console.error('Failed to create session request:', error)
        } finally {
            setConnectingPostId(null)
        }
    }

    const handleMarkCompleted = async (id: number) => {
        await markCompleted(id)
    }

    // Check if user can afford to learn (needs credits if learning only)
    const canAffordLearning = user && (user.credits > 0 || !okWithJustLearning)

    // Filter posts
    const displayPosts = showMyPosts
        ? myPosts.filter(p => !p.is_completed)
        : posts.filter(p => {
            // Exclude own posts
            if (p.creator_id === user?.id) return false
            // Bounty filter
            if (okWithJustLearning && !p.ok_with_just_learning) return false

            // Relevance filter (after creating a post)
            if (relevanceFilter) {
                const learn = relevanceFilter.learn.toLowerCase()
                const teach = relevanceFilter.teach.toLowerCase()
                const postLearn = p.topic_to_learn.toLowerCase()
                const postTeach = (p.topic_to_teach || '').toLowerCase()

                // Show posts where their topics overlap with mine
                const teachMatch = teach && (postLearn.includes(teach) || postTeach.includes(teach))
                const learnMatch = learn && (postTeach.includes(learn) || postLearn.includes(learn))
                return teachMatch || learnMatch
            }

            // Search Query Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                return (
                    p.topic_to_learn.toLowerCase().includes(query) ||
                    (p.topic_to_teach && p.topic_to_teach.toLowerCase().includes(query)) ||
                    p.creator_name.toLowerCase().includes(query)
                )
            }
            return true
        })

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Search Box - Center Focus */}
            <motion.section
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                aria-labelledby="search-heading"
            >
                <h2 id="search-heading" className="text-xl font-bold mb-6 text-center">
                    Create a Learning Request
                </h2>

                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label htmlFor="topic-learn" className="block text-sm font-medium text-slate-600 mb-2">
                            I want to learn...
                        </label>
                        <input
                            id="topic-learn"
                            type="text"
                            value={topicLearn}
                            onChange={(e) => setTopicLearn(e.target.value)}
                            className="input"
                            placeholder="e.g., React, Python, Guitar..."
                            required
                            maxLength={255}
                        />
                    </div>

                    <div>
                        <label htmlFor="topic-teach" className="block text-sm font-medium text-slate-600 mb-2">
                            I can teach...
                        </label>
                        <input
                            id="topic-teach"
                            type="text"
                            value={topicTeach}
                            onChange={(e) => setTopicTeach(e.target.value)}
                            className="input"
                            placeholder="e.g., JavaScript, Design, Piano..."
                            disabled={okWithJustLearning}
                            maxLength={255}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            id="learning-only"
                            type="checkbox"
                            checked={okWithJustLearning}
                            onChange={(e) => setOkWithJustLearning(e.target.checked)}
                            className="w-5 h-5 rounded border-primary/30 bg-surface text-primary focus:ring-primary"
                        />
                        <label htmlFor="learning-only" className="text-sm text-slate-600">
                            I'm ok with just learning (will cost credits)
                        </label>
                    </div>

                    {okWithJustLearning && user && user.credits <= 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
                            ⚠️ You have 0 credits. You won't be able to pay for learning sessions.
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary w-full py-3.5 sm:py-3 text-base sm:text-sm"
                        disabled={isSubmitting || !topicLearn.trim() || !canAffordLearning}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-sm">Creating...</span>
                            </span>
                        ) : (
                            '🔍 Search & Create Post'
                        )}
                    </button>
                </form>
            </motion.section>

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={clearError} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* User Search Results */}
            {searchQuery && (
                <section aria-labelledby="users-heading">
                    <h2 id="users-heading" className="text-lg font-semibold text-slate-700 mb-4">
                        Users matching "{searchQuery}"
                    </h2>

                    {isSearchingUsers ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Searching users...
                        </div>
                    ) : searchedUsers.length > 0 ? (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {searchedUsers.map(u => (
                                <motion.div key={u.id} variants={itemVariants}>
                                    <Link to={`/user/${u.id}`} className="card hover:border-primary/50 transition-colors flex items-center gap-4 h-full">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold">
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{u.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                {u.average_rating ? (
                                                    <span className="text-yellow-400">★ {u.average_rating.toFixed(1)}</span>
                                                ) : (
                                                    <span>No ratings</span>
                                                )}
                                                {u.is_online ? (
                                                    <span className="text-green-500">• Online</span>
                                                ) : u.availability ? (
                                                    <span className="text-slate-500 text-[10px]">• {u.availability}</span>
                                                ) : (
                                                    <span className="text-slate-600">• Offline</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <p className="text-slate-500 italic">No users found matching "{searchQuery}"</p>
                    )}
                </section>
            )}

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setShowMyPosts(false)}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${!showMyPosts
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-slate-500 hover:text-primary hover:bg-primary/5'
                            }`}
                    >
                        All Requests
                    </button>
                    <button
                        onClick={() => setShowMyPosts(true)}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${showMyPosts
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-slate-500 hover:text-primary hover:bg-primary/5'
                            }`}
                    >
                        My Posts ({myPosts.filter(p => !p.is_completed).length})
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!showMyPosts && (
                        <button
                            onClick={() => setOkWithJustLearning(!okWithJustLearning)}
                            className={`w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2 ${okWithJustLearning
                                ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                : 'bg-primary/5 text-slate-500 border-primary/10 hover:text-primary'
                                }`}
                            title="Show only requests offering credits"
                        >
                            <span>💰</span>
                            <span>Credits Only</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Posts Feed */}
            <section aria-labelledby="feed-heading">
                <div className="flex items-center justify-between mb-4">
                    <h2 id="feed-heading" className="text-lg font-semibold text-slate-700">
                        {showMyPosts ? 'My Learning Posts' : relevanceFilter ? `Matching Results for "${relevanceFilter.learn}"` : 'Active Learning Requests'}
                    </h2>
                    <div className="flex items-center gap-3">
                        {relevanceFilter && (
                            <button
                                onClick={() => setRelevanceFilter(null)}
                                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                                ✕ Clear filter
                            </button>
                        )}
                        <button
                            onClick={() => {
                                fetchPosts()
                                fetchMyPosts()
                            }}
                            className="text-sm text-slate-500 hover:text-primary flex items-center gap-1"
                            disabled={isLoading}
                        >
                            <span className={isLoading ? 'animate-spin' : ''}>↻</span> Refresh
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="card py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-500">Loading posts...</p>
                        </div>
                    </div>
                ) : displayPosts.length === 0 ? (
                    <div className="card text-center py-12 text-slate-500">
                        <p className="text-xl mb-2">🔍</p>
                        <p>
                            {showMyPosts
                                ? "You haven't created any posts yet."
                                : relevanceFilter
                                    ? "No matching posts found yet. Your post is live — others will see it!"
                                    : "No active requests. Be the first to post!"}
                        </p>
                        {relevanceFilter && (
                            <button
                                onClick={() => setRelevanceFilter(null)}
                                className="mt-3 text-sm text-primary hover:underline"
                            >
                                Show all requests
                            </button>
                        )}
                    </div>
                ) : (
                    <motion.ul
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        key={showMyPosts ? 'my-posts' : 'all-posts'}
                        className="space-y-4"
                    >
                        <AnimatePresence mode="popLayout">
                            {displayPosts.map((post) => (
                                <motion.li
                                    key={post.id}
                                    variants={itemVariants}
                                    layout
                                    exit={{ opacity: 0, x: -20 }}
                                    className="card hover:border-primary/50 transition-colors p-4 sm:p-6"
                                >
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Link
                                                    to={`/user/${post.creator_id}`}
                                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-sm font-bold relative flex-shrink-0">
                                                        {post.creator_name.charAt(0).toUpperCase()}
                                                        <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isUserOnline(post.creator_id) ? 'bg-green-500' : 'bg-slate-300'
                                                            }`} />
                                                    </div>
                                                    <span className="font-medium hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-none">
                                                        {post.creator_name}
                                                    </span>
                                                </Link>
                                                {post.creator_rating !== null && (
                                                    <span className="text-yellow-400 text-sm whitespace-nowrap">★ {Number(post.creator_rating).toFixed(1)}</span>
                                                )}
                                            </div>

                                            <p className="text-base sm:text-lg">
                                                Wants to learn <span className="text-primary font-semibold">{post.topic_to_learn}</span>
                                            </p>

                                            {post.topic_to_teach && (
                                                <p className="text-sm sm:text-slate-500 mt-1">
                                                    Can teach: <span className="text-accent-dark">{post.topic_to_teach}</span>
                                                </p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                                {post.ok_with_just_learning && (
                                                    <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] sm:text-xs rounded font-medium uppercase tracking-wider">
                                                        Learning only
                                                    </span>
                                                )}
                                                {post.bounty_enabled && (
                                                    <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 text-[10px] sm:text-xs rounded font-medium uppercase tracking-wider">
                                                        💰 Bounty
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="w-full sm:w-auto pt-2 sm:pt-0">
                                            {showMyPosts ? (
                                                <button
                                                    onClick={() => handleMarkCompleted(post.id)}
                                                    className="btn-secondary w-full sm:w-auto text-sm py-2.5 sm:py-2"
                                                >
                                                    Mark Done
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleConnect(post)}
                                                    disabled={connectingPostId === post.id}
                                                    className="btn-primary w-full sm:w-auto text-sm py-2.5 sm:py-2 shadow-lg sm:shadow-md"
                                                >
                                                    {connectingPostId === post.id ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            Connecting...
                                                        </span>
                                                    ) : (
                                                        'Connect'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </motion.ul>
                )}
            </section>

            {/* Offline Peer Notification Modal */}
            <AnimatePresence>
                {offlinePeer && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.9 }}
                            className="max-w-sm w-full p-8 text-center space-y-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-white/10 bg-slate-900 text-white rounded-2xl relative overflow-hidden"
                        >
                            {/* Decorative element */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />

                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-4xl shadow-2xl border border-white/5">
                                🌙
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black uppercase tracking-tight">{offlinePeer.name} is Offline</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    You can only join sessions when both participants are online.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-1">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Their Availability</p>
                                <p className="text-primary-light font-bold text-lg">{offlinePeer.availability}</p>
                            </div>

                            <button
                                onClick={() => setOfflinePeer(null)}
                                className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-lg hover:bg-slate-200 transition-colors shadow-xl active:scale-95"
                            >
                                Understood
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    )
}
