'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { useSession, signOut, signIn } from 'next-auth/react'
import { VERSION } from '@/lib/version'
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
  LogOut,
  LogIn,
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
  
  // Safely call useSession and provide defaults to avoid build-time crashes
  const sessionData = useSession()
  const session = sessionData?.data || null
  const status = sessionData?.status || 'unauthenticated'

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

  const handleSignOut = () => {
    signOut()
    handleCloseMenu()
  }

  const handleSignIn = () => {
    signIn()
    handleCloseMenu()
  }

  // Filter nav items based on auth status
  const filteredNavItems = navItems.filter((item) => {
    const authRequiredRoutes = ['/predictions/new', '/notifications', '/profile']
    if (authRequiredRoutes.includes(item.href)) {
      return status === 'authenticated'
    }
    return true
  })

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-50">
        <Link href="/" className="flex items-center gap-2" onClick={handleCloseMenu}>
          <Image src="/logo-icon.svg" alt="DAATAN" width={40} height={40} priority />
          <h1 className="text-lg font-bold text-gray-900">DAATAN</h1>
        </Link>
        <div className="flex items-center gap-2">
          {status === 'authenticated' && session?.user?.image && (
            <Link href="/profile" onClick={handleCloseMenu}>
              <Image
                src={session.user.image}
                alt={session.user.name || 'User'}
                width={32}
                height={32}
                className="rounded-full border border-gray-200"
              />
            </Link>
          )}
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
        </div>
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
        {/* Logo */}
        <Link href="/" className="hidden lg:flex p-6 items-center gap-3 hover:bg-gray-50 transition-colors">
          <Image src="/logo-icon.svg" alt="DAATAN" width={48} height={48} priority />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">DAATAN</h1>
              <span className="text-xs text-gray-400 font-mono">v{VERSION}</span>
            </div>
            <p className="text-sm text-gray-400">Prediction Market</p>
          </div>
        </Link>

        {/* Mobile Logo Spacer */}
        <div className="lg:hidden h-16" />

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href
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

        {/* User Section */}
        <div className="p-4 border-t border-gray-100">
          {status === 'loading' ? (
            <div className="animate-pulse flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ) : status === 'authenticated' && session?.user ? (
            <div className="space-y-1">
              <Link
                href="/profile"
                onClick={handleCloseMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                    {session.user.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate text-sm">{session.user.name || 'User'}</p>
                  <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              <span className="font-medium">Sign In</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
