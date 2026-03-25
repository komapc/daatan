'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import ForecastsTable from './ForecastsTable'
import UsersTable from './UsersTable'
import CommentsTable from './CommentsTable'
import BotsTable from './BotsTable'

type Tab = 'forecasts' | 'users' | 'comments' | 'bots'

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<Tab>('forecasts')

  const isAdmin = session?.user?.role === 'ADMIN'

  const tab = (id: Tab, label: string, adminOnly = false) => {
    if (adminOnly && !isAdmin) return null
    return (
      <button
        key={id}
        className={`px-4 py-2 ${activeTab === id ? 'border-b-2 border-blue-500 font-bold' : ''}`}
        onClick={() => setActiveTab(id)}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <div className="flex gap-4 border-b mb-6">
        {tab('forecasts', 'Forecasts')}
        {tab('users', 'Users', true)}
        {tab('comments', 'Comments')}
        {tab('bots', 'Bots', true)}
      </div>

      {activeTab === 'forecasts' && <ForecastsTable />}
      {activeTab === 'users' && isAdmin && <UsersTable />}
      {activeTab === 'comments' && <CommentsTable />}
      {activeTab === 'bots' && isAdmin && <BotsTable />}
    </div>
  )
}
