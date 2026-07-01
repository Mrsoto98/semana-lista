import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
