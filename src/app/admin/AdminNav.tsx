'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

type Tab = {
  id: string
  label: string
  /** Only visible to ADMIN users */
  adminOnly?: boolean
}

const TABS: Tab[] = [
  { id: 'approvals', label: '⏳ Approvals' },
  { id: 'forecasts', label: 'Forecasts' },
  { id: 'comments', label: 'Comments' },
  { id: 'users', label: 'Users', adminOnly: true },
  { id: 'bots', label: 'Bots', adminOnly: true },
]

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/approvals?limit=1')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setPendingCount(data.total))
      .catch(() => { })
  }, [])

  return (
    <div className="flex gap-1 sm:gap-4 border-b mb-6 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide -mx-2 px-2">
      {TABS.filter(t => !t.adminOnly || isAdmin).map(t => {
        const href = `/admin/${t.id}`
        const active = pathname === href || pathname.startsWith(href + '/')
        const showBadge = t.id === 'approvals' && pendingCount !== null && pendingCount > 0
        return (
          <Link
            key={t.id}
            href={href}
            className={`px-3 sm:px-4 py-2 shrink-0 text-sm transition-colors ${active
              ? 'border-b-2 border-blue-500 font-bold text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t.label}
            {showBadge && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
