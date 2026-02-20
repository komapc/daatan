import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminNav from './AdminNav'

export const metadata = {
  title: 'Admin Dashboard | Daatan',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'RESOLVER')) {
    redirect('/')
  }

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Admin Dashboard</h1>
      <AdminNav isAdmin={isAdmin} />
      {children}
    </div>
  )
}
