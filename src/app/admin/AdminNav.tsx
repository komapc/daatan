'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { id: 'forecasts', label: 'Forecasts', adminOnly: false },
  { id: 'users', label: 'Users', adminOnly: true },
  { id: 'comments', label: 'Comments', adminOnly: false },
  { id: 'bots', label: 'Bots', adminOnly: true },
]

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  return (
    <div className="flex gap-4 border-b mb-6 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
      {TABS.filter(t => !t.adminOnly || isAdmin).map(t => {
        const href = `/admin/${t.id}`
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={t.id}
            href={href}
            className={`px-4 py-2 shrink-0 ${active ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
