'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import {
  Home,
  Bell,
  PlusCircle,
  Trophy,
  User,
  Settings,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/predictions', label: 'Predictions', icon: TrendingUp },
  { href: '/predictions/new', label: 'New Prediction', icon: PlusCircle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const Sidebar = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleToggleMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleCloseMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleToggleMenu()
    }
  }

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-50">
        <Link href="/" className="flex items-center gap-2" onClick={handleCloseMenu}>
          <Image src="/logo-icon.svg" alt="DAATAN" width={40} height={40} priority />
          <h1 className="text-lg font-bold text-gray-900">DAATAN</h1>
        </Link>
        <button
          onClick={handleToggleMenu}
          onKeyDown={handleKeyDown}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          tabIndex={0}
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-600" />
          ) : (
            <Menu className="w-6 h-6 text-gray-600" />
          )}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={handleCloseMenu}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseMenu()}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo - Hidden on mobile (shown in header instead) */}
        <Link href="/" className="hidden lg:flex p-6 items-center gap-3 hover:bg-gray-50 transition-colors">
          <Image src="/logo-icon.svg" alt="DAATAN" width={48} height={48} priority />
          <div>
            <h1 className="text-xl font-bold text-gray-900">DAATAN</h1>
            <p className="text-sm text-gray-400">Prediction Market</p>
          </div>
        </Link>

        {/* Mobile Logo Spacer */}
        <div className="lg:hidden h-16" />

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-1">
            {navItems.map((item) => {
              // Exact match for specific routes, or startsWith for parent routes (but not for sub-items)
              const isExactMatch = pathname === item.href
              const isParentMatch = item.href !== '/' && pathname.startsWith(item.href + '/')
              // Don't highlight /predictions if we're on /predictions/new (which has its own nav item)
              const hasMoreSpecificMatch = navItems.some(
                other => other.href !== item.href && 
                         other.href.startsWith(item.href + '/') && 
                         pathname === other.href
              )
              const isActive = isExactMatch || (isParentMatch && !hasMoreSpecificMatch)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleCloseMenu}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
