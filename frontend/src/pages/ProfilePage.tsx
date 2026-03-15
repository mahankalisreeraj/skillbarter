import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSessionsStore } from '@/stores/sessionsStore'
import { usePresenceStore } from '@/stores/presenceStore'
import ReviewCard from '@/components/ReviewCard'
import WeeklyPerformanceGraph from '@/components/profile/WeeklyPerformanceGraph'
import type { Review, LearningPost } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
} as const

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" }
    }
} as const

interface ProfileData {
    id: number
    name: string
    email?: string
    credits?: number
    is_online: boolean
    availability?: string
    average_rating: number | null
    total_reviews: number
    date_joined?: string
    login_streak?: number
    total_credits_earned?: number
    hours_taught?: number
    weekly_activity?: { date: string; hours_taught: number; credits_earned: number }[]
}

export default function ProfilePage() {
    const { username } = useParams<{ username?: string }>()
    const { user: currentUser, fetchProfile, isAuthenticated } = useAuthStore()
    const { isUserOnline } = usePresenceStore()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [posts, setPosts] = useState<LearningPost[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // If no username param, show current user's profile
    const isOwnProfile = !username || (currentUser && username === String(currentUser.id))

    // Session creation
    const { createSession } = useSessionsStore()
    const navigate = useNavigate()
    const [connectingPostId, setConnectingPostId] = useState<number | null>(null)

    useEffect(() => {
        const loadProfile = async () => {
            setIsLoading(true)
            setErrorMsg(null)
            try {
                let userId: number | string | undefined

                if (isOwnProfile) {
                    if (currentUser) {
                        userId = currentUser.id
                        setProfile({
                            id: currentUser.id,
                            name: currentUser.name,
                            email: currentUser.email,
                            credits: currentUser.credits,
                            is_online: currentUser.is_online,
                            availability: currentUser.availability,
                            average_rating: currentUser.average_rating,
                            total_reviews: currentUser.total_reviews,
                            date_joined: currentUser.date_joined,
                            login_streak: currentUser.login_streak,
                            total_credits_earned: currentUser.total_credits_earned,
                            hours_taught: currentUser.hours_taught,
                            weekly_activity: currentUser.weekly_activity,
                        })
                    } else if (isAuthenticated) {
                        await fetchProfile()
                        return // Will re-run when currentUser is updated
                    }
                } else {
                    userId = username
                    const userRes = await api.get(`/users/${userId}/`)
                    const userData = userRes.data
                    setProfile({
                        id: userData.id,
                        name: userData.name,
                        is_online: userData.is_online,
                        availability: userData.availability,
                        average_rating: userData.average_rating,
                        total_reviews: userData.total_reviews,
                        total_credits_earned: userData.total_credits_earned,
                        hours_taught: userData.hours_taught,
                        weekly_activity: userData.weekly_activity,
                    })
                }

                if (userId) {
                    // Fetch reviews
                    try {
                        const reviewsRes = await api.get(`/users/${userId}/reviews/`)
                        const reviewsData = Array.isArray(reviewsRes.data)
                            ? reviewsRes.data
                            : (reviewsRes.data?.results ?? [])
                        setReviews(reviewsData)
                    } catch { /* ignore */ }

                    // Fetch active posts
                    try {
                        const postsRes = await api.get(`/posts/?creator=${userId}`)
                        const postsData = Array.isArray(postsRes.data)
                            ? postsRes.data
                            : (postsRes.data?.results ?? [])
                        setPosts(postsData)
                    } catch { /* ignore */ }
                }

            } catch (error: any) {
                console.error('Failed to fetch profile:', error)
                setErrorMsg(error.response?.data?.detail || 'User not found')
                setProfile(null)
            } finally {
                setIsLoading(false)
            }
        }

        loadProfile()
    }, [username, isOwnProfile, fetchProfile, currentUser, isAuthenticated])

    const handleConnect = async (post: LearningPost) => {
        if (!currentUser) return // Should be handled by UI state

        setConnectingPostId(post.id)
        try {
            const session = await createSession(post.creator_id, post.id)
            navigate(`/session/${session.id}`)
        } catch (error) {
            console.error('Failed to start session:', error)
            alert('Failed to start session. Please try again.')
        } finally {
            setConnectingPostId(null)
        }
    }

    // Update profile when currentUser changes (for own profile)
    useEffect(() => {
        if (isOwnProfile && currentUser) {
            setProfile({
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                credits: currentUser.credits,
                is_online: currentUser.is_online,
                availability: currentUser.availability,
                average_rating: currentUser.average_rating,
                total_reviews: currentUser.total_reviews,
                date_joined: currentUser.date_joined,
                login_streak: currentUser.login_streak,
                total_credits_earned: currentUser.total_credits_earned,
                hours_taught: currentUser.hours_taught,
                weekly_activity: currentUser.weekly_activity,
            })
        }
    }, [currentUser, isOwnProfile])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500">Loading profile...</p>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <p className="text-xl text-slate-500">{errorMsg || 'User not found'}</p>
                <Link to="/search" className="text-primary hover:underline mt-4 inline-block">
                    ← Back to Search
                </Link>
            </div>
        )
    }

    const avgRating = profile.average_rating ?? 0

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-3xl mx-auto space-y-8 pb-12"
        >
            {/* Profile Header */}
            <motion.div variants={itemVariants} className="card">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl font-bold relative">
                        {profile.name.charAt(0).toUpperCase()}
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface ${isUserOnline(profile.id) ? 'bg-green-500' : 'bg-slate-500'
                            }`} />
                    </div>

                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{profile.name}</h1>
                        {isOwnProfile && profile.email && (
                            <p className="text-slate-500 text-sm">{profile.email}</p>
                        )}

                        {/* Rating Badge */}
                        <div className="flex items-center gap-3 mt-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <span
                                        key={star}
                                        className={`text-xl ${star <= Math.round(avgRating) ? 'text-yellow-400' : 'text-slate-600'}`}
                                    >
                                        ★
                                    </span>
                                ))}
                            </div>
                            <span className="text-lg font-semibold">{avgRating.toFixed(1)}</span>
                            <span className="text-slate-500 text-sm">
                                ({profile.total_reviews} review{profile.total_reviews !== 1 ? 's' : ''})
                            </span>
                        </div>
                    </div>

                    {/* Credits (only for own profile) */}
                    {isOwnProfile && profile.credits !== undefined && (
                        <div className="text-right">
                            <p className="text-3xl font-bold text-primary">{Number(profile.credits).toFixed(2)}</p>
                            <p className="text-slate-500 text-sm">Credits</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
                <div className="card text-center py-6 hover:bg-primary/5 transition-colors">
                    <p className="text-3xl font-bold text-primary">{avgRating.toFixed(1)}</p>
                    <p className="text-slate-500 text-sm mt-1">Avg Rating</p>
                </div>
                <div className="card text-center py-6 hover:bg-primary/5 transition-colors">
                    <p className="text-3xl font-bold text-accent-dark">{profile.total_reviews}</p>
                    <p className="text-slate-500 text-sm mt-1">Reviews</p>
                </div>
                <div className="card text-center py-6 hover:bg-primary/5 transition-colors">
                    <p className="text-3xl font-bold text-primary">
                        {isUserOnline(profile.id) ? '🟢' : '⚫'}
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                        {isUserOnline(profile.id) ? 'Online' : 'Offline'}
                    </p>
                    {!isUserOnline(profile.id) && (
                        <p className="text-xs text-primary mt-2 border-t border-primary/10 pt-2">
                            {profile.availability ? `Expected: ${profile.availability}` : 'No availability provided'}
                        </p>
                    )}
                </div>
            </motion.div>

            {/* Performance Metrics Stats Grid */}
            {(profile.total_credits_earned !== undefined && profile.hours_taught !== undefined) && (
                <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                    <div className="card text-center py-6 hover:bg-primary/5 transition-colors border border-amber-500/20 bg-gradient-to-br from-amber-50 to-white">
                        <p className="text-3xl font-bold text-amber-500">{Number(profile.total_credits_earned).toFixed(2)}</p>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-semibold">Total Credits Earned</p>
                    </div>
                    <div className="card text-center py-6 hover:bg-primary/5 transition-colors border border-blue-500/20 bg-gradient-to-br from-blue-50 to-white">
                        <p className="text-3xl font-bold text-blue-500">{Number(profile.hours_taught).toFixed(1)}</p>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-semibold">Hours Taught</p>
                    </div>
                </motion.div>
            )}

            {/* Weekly Performance Graph */}
            {profile.weekly_activity && profile.weekly_activity.length > 0 && (
                <motion.div variants={itemVariants}>
                    <WeeklyPerformanceGraph data={profile.weekly_activity} />
                </motion.div>
            )}

            {/* Streak Progress (only for own profile) */}
            {isOwnProfile && (
                <motion.div variants={itemVariants} className="card bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span className="text-2xl animate-pulse">🔥</span> 
                            7-Day Login Streak
                        </h3>
                        <div className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-full text-sm">
                            Day {profile.login_streak || 0} / 7
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-3 mb-2 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${((profile.login_streak || 0) / 7) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-sm text-slate-500 text-center">
                        {(profile.login_streak || 0) >= 7 
                            ? "You've earned your 7 credits! Come back tomorrow for a new streak."
                            : `Log in ${7 - (profile.login_streak || 0)} more consecutive days to earn 7 free credits!`}
                    </p>
                </motion.div>
            )}

            {/* Active Learning Requests */}
            <motion.section variants={itemVariants} aria-labelledby="requests-heading">
                <h2 id="requests-heading" className="text-lg font-semibold mb-4 text-slate-700">
                    Active Learning Requests
                </h2>
                {posts.length === 0 ? (
                    <div className="card text-center py-8 text-slate-500 italic">
                        No active requests from {profile.name}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {posts.map((post) => (
                                <motion.div
                                    key={post.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="card hover:border-primary/50 transition-colors flex items-center justify-between gap-4"
                                >
                                    <div>
                                        <p className="text-lg">
                                            Wants to learn <span className="text-primary font-bold">{post.topic_to_learn}</span>
                                        </p>
                                        {post.topic_to_teach && (
                                            <p className="text-slate-500 text-sm mt-1">
                                                Can teach: <span className="text-accent-dark">{post.topic_to_teach}</span>
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            {post.ok_with_just_learning && (
                                                <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
                                                    Learning only
                                                </span>
                                            )}
                                            {post.bounty_enabled && (
                                                <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                                    💰 Bounty
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {!isOwnProfile && (
                                        <button
                                            onClick={() => handleConnect(post)}
                                            disabled={connectingPostId === post.id}
                                            className="btn-primary"
                                        >
                                            {connectingPostId === post.id ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Connecting...
                                                </span>
                                            ) : (
                                                'Connect'
                                            )}
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </motion.section>

            {/* Reviews Section */}
            <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold mb-4 text-slate-700">Reviews</h2>

                {reviews.length === 0 ? (
                    <div className="card text-center py-8 text-slate-500">
                        No reviews yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <ReviewCard
                                key={review.id}
                                reviewerId={typeof review.reviewer === 'object' ? review.reviewer.id : review.reviewer}
                                reviewerName={review.reviewer_name}
                                rating={review.rating}
                                comment={review.comment}
                                createdAt={review.created_at}
                            />
                        ))}
                    </div>
                )}
            </motion.section>

            {/* Profile Menu (only for own profile) */}
            {isOwnProfile && (
                <motion.nav variants={itemVariants} className="card divide-y divide-primary/10" role="navigation" aria-label="Profile menu">
                    <Link to="/sessions" className="flex items-center gap-4 py-4 hover:text-primary transition-colors group">
                        <span className="text-xl group-hover:scale-125 transition-transform duration-300">📚</span>
                        <span>My Sessions</span>
                    </Link>
                    <Link to="/search" className="flex items-center gap-4 py-4 hover:text-primary transition-colors group">
                        <span className="text-xl group-hover:scale-125 transition-transform duration-300">🔍</span>
                        <span>Find Sessions</span>
                    </Link>
                </motion.nav>
            )}
        </motion.div>
    )
}
