import { Suspense } from 'react'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminClient />
    </Suspense>
  )
}
