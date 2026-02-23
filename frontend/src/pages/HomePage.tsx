import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { motion } from 'framer-motion'

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" }
    }
} as const

export default function HomePage() {
    const { isAuthenticated } = useAuthStore()

    return (
        <div className="space-y-16 lg:space-y-24">
            {/* Hero Section */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="text-center py-16 lg:py-24"
            >
                <motion.h1 variants={itemVariants} className="text-4xl lg:text-6xl font-bold mb-6">
                    Learn anything.
                    <br />
                    <span className="bg-gradient-to-r from-primary-light via-purple-400 to-accent bg-clip-text text-transparent">
                        Teach something.
                    </span>
                </motion.h1>

                <motion.p variants={itemVariants} className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
                    A peer-to-peer learning platform where your time creates value.
                    Earn credits by teaching, spend them to learn.
                </motion.p>

                <motion.div variants={itemVariants} className="flex items-center justify-center gap-4">
                    {isAuthenticated ? (
                        <Link to="/search" className="btn-primary text-lg px-8 py-4">
                            Start Learning →
                        </Link>
                    ) : (
                        <>
                            <Link to="/signup" className="btn-primary text-lg px-8 py-4">
                                Get Started Free
                            </Link>
                            <Link to="/login" className="btn-secondary text-lg px-8 py-4">
                                Sign In
                            </Link>
                        </>
                    )}
                </motion.div>
            </motion.section>

            {/* How It Works */}
            <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={containerVariants}
                className="py-16"
            >
                <motion.h2 variants={itemVariants} className="text-2xl font-bold text-center mb-12">How It Works</motion.h2>

                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    <motion.div variants={itemVariants} className="card text-center hover:scale-105 transition-transform duration-300">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl">
                            🎁
                        </div>
                        <h3 className="font-bold mb-2">Start with 15 Credits</h3>
                        <p className="text-slate-400 text-sm">
                            New users receive 15 free credits to begin their learning journey.
                        </p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="card text-center hover:scale-105 transition-transform duration-300">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center text-3xl">
                            ⏱️
                        </div>
                        <h3 className="font-bold mb-2">5 Minutes = 1 Credit</h3>
                        <p className="text-slate-400 text-sm">
                            Teach for 5 minutes to earn 1 credit. Learning costs the same rate.
                        </p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="card text-center hover:scale-105 transition-transform duration-300">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center text-3xl">
                            🔄
                        </div>
                        <h3 className="font-bold mb-2">Exchange Knowledge</h3>
                        <p className="text-slate-400 text-sm">
                            Match with peers who want to learn what you know, and vice versa.
                        </p>
                    </motion.div>
                </div>
            </motion.section>

            {/* Stats Bar */}
            <motion.section
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="py-12 border-t border-b border-slate-700/50"
            >
                <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
                    <div>
                        <p className="text-3xl font-bold text-primary-light">10%</p>
                        <p className="text-slate-400 text-sm">Platform Fee</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-accent">Free</p>
                        <p className="text-slate-400 text-sm">To Join</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-purple-400">∞</p>
                        <p className="text-slate-400 text-sm">Skills to Learn</p>
                    </div>
                </div>
            </motion.section>
        </div>
    )
}
