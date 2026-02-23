import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import SearchPage from './pages/SearchPage'
import SessionPage from './pages/SessionPage'
import SessionsPage from './pages/SessionsPage'
import ProfilePage from './pages/ProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import AnimatedPage from './components/AnimatedPage'

function App() {
    const location = useLocation()

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Layout />}>
                    {/* Public Routes */}
                    <Route index element={<AnimatedPage><HomePage /></AnimatedPage>} />
                    <Route path="login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
                    <Route path="signup" element={<AnimatedPage><SignupPage /></AnimatedPage>} />

                    {/* Public Profile (viewable by anyone) */}
                    <Route path="user/:username" element={<AnimatedPage><ProfilePage /></AnimatedPage>} />

                    {/* Protected Routes */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="search" element={<AnimatedPage><SearchPage /></AnimatedPage>} />
                        <Route path="sessions" element={<AnimatedPage><SessionsPage /></AnimatedPage>} />
                        <Route path="session/:sessionId" element={<AnimatedPage><SessionPage /></AnimatedPage>} />
                        <Route path="profile" element={<AnimatedPage><ProfilePage /></AnimatedPage>} />
                    </Route>

                    {/* Catch all - redirect to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </AnimatePresence>
    )
}

export default App
