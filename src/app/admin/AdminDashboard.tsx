'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import ForecastsTable from './ForecastsTable'
import UsersTable from './UsersTable'
import CommentsTable from './CommentsTable'

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'forecasts' | 'users' | 'comments'>('forecasts')

  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <div>
      <div className="flex gap-4 border-b mb-6">
        <button
          className={`px-4 py-2 ${activeTab === 'forecasts' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('forecasts')}
        >
          Forecasts
        </button>
        {isAdmin && (
          <button
            className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
        )}
        <button
          className={`px-4 py-2 ${activeTab === 'comments' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments
        </button>
      </div>
      
      {activeTab === 'forecasts' && <ForecastsTable />}
      {activeTab === 'users' && isAdmin && <UsersTable />}
      {activeTab === 'comments' && <CommentsTable />}
    </div>
  )
}
