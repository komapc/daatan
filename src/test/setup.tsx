import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Ensure env validation is skipped in tests; set dummies so @t3-oss/env-nextjs has values if any test imports env
process.env.SKIP_ENV_VALIDATION = '1'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy'
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dummy-secret-for-build'
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '123456789-dummy.apps.googleusercontent.com'
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret-min-10-chars'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}))

// Mock @/i18n/routing
vi.mock('@/i18n/routing', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  Link: ({ children, href, ...props }: any) => {
    // Basic Link mock that just renders children
    return (<a href={href} {...props}>{children}</a>)
  },
}))

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))
