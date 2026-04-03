'use client'

import { usePathname } from 'next/navigation'

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname.startsWith('/auth/')
  return (
    <main className={`flex-1 min-w-0 overflow-x-hidden${isAuth ? '' : ' lg:ml-64 mt-16 lg:mt-0'}`}>
      {children}
    </main>
  )
}
