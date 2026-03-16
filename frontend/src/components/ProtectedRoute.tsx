import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute() {
    const { isAuthenticated, isHydrated } = useAuthStore()

    // ONLY wait for hydration. 
    // Do NOT block on isLoading here; global loading states (like token refresh) 
    // should happen in the background without unmounting the whole app.
    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />
                    <p className="text-slate-400 font-medium animate-pulse">Initializing SkillBarter...</p>
                </div>
            </div>
        )
    }

    // Only redirect after hydration is complete
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
