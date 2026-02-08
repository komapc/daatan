'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useSession, signOut, signIn } from 'next-auth/react'
import { VERSION } from '@/lib/version'
import { Avatar } from './Avatar'
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
  History,
  Shield,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/predictions', label: 'Forecasts', icon: TrendingUp },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/retroanalysis', label: 'Retroanalysis', icon: History },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const Sidebar = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  
  // Safely call useSession and provide defaults to avoid build-time crashes
  const sessionData = useSession()
  const session = sessionData?.data || null
  const status = sessionData?.status || 'unauthenticated'

  // Track mount state to avoid hydration mismatch
  // Server always renders the "loading" state; client switches after mount
  useEffect(() => {
    setHasMounted(true)
  }, [])

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

  // Use "loading" state for SSR and pre-mount to ensure server/client HTML matches
  const effectiveStatus = hasMounted ? status : 'loading'

  // Filter nav items based on auth status (only after mount to avoid hydration mismatch)
  const filteredNavItems = hasMounted
    ? navItems.filter((item) => {
        const authRequiredRoutes = ['/create', '/notifications', '/profile']
        if (authRequiredRoutes.includes(item.href)) {
          return status === 'authenticated'
        }
        return true
      })
    : navItems.filter((item) => {
        // During SSR/pre-mount, show all non-auth routes
        const authRequiredRoutes = ['/create', '/notifications', '/profile']
        return !authRequiredRoutes.includes(item.href)
      })

  // Add admin link for admin/moderator users
  if (hasMounted && status === 'authenticated' && (session?.user?.role === 'ADMIN' || session?.user?.role === 'RESOLVER')) {
    filteredNavItems.push({ href: '/admin', label: 'Admin', icon: Shield })
  }

  // Add Sign In button to nav if unauthenticated (only after mount)
  if (hasMounted && status === 'unauthenticated') {
    filteredNavItems.push({ href: '#', label: 'Sign In', icon: LogIn })
  }

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-50">
        <Link href="/" className="flex items-center gap-2" onClick={handleCloseMenu}>
          <Image src="/logo-icon.svg" alt="DAATAN" width={40} height={40} priority />
          <h1 className="text-lg font-bold text-gray-900">DAATAN</h1>
        </Link>
        <div className="flex items-center gap-2">
          {hasMounted && status === 'authenticated' && session?.user && (
            <Link href="/profile" onClick={handleCloseMenu}>
              <Avatar 
                src={session.user.image} 
                name={session.user.name}
                size={32}
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
                    onClick={item.label === 'Sign In' ? handleSignIn : handleCloseMenu}
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
          {effectiveStatus === 'loading' ? (
            <div className="animate-pulse flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ) : effectiveStatus === 'authenticated' && session?.user ? (
            <div className="space-y-1">
              <Link
                href="/profile"
                onClick={handleCloseMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Avatar 
                  src={session.user.image} 
                  name={session.user.name}
                  size={32}
                />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate text-sm">{session.user.name || 'User'}</p>
                  <p className="text-xs text-gray-400 truncate mb-1">{session.user.email}</p>
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                    <span className="w-3 h-3 rounded-full border border-amber-600 flex items-center justify-center text-[8px] font-bold">C</span>
                    {session.user.cuAvailable ?? 0} CU
                  </div>
                  {(session.user.role === 'ADMIN' || session.user.role === 'RESOLVER') && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {session.user.role === 'ADMIN' && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Admin</span>
                      )}
                      {session.user.role === 'RESOLVER' && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Resolver</span>
                      )}
                    </div>
                  )}
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
