import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { env } from '@/env'

const log = createLogger('auth')

const isStaging = env.NEXT_PUBLIC_ENV === 'staging'
/** Staging and production both run behind nginx; use explicit cookie options for both. */
const isHosted = env.NEXT_PUBLIC_ENV === 'staging' || env.NEXT_PUBLIC_ENV === 'production'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: env.NEXTAUTH_SECRET,
  debug: isStaging || env.NEXTAUTH_DEBUG === 'true',
  // Trust Host header: set AUTH_TRUST_HOST=true when behind nginx (see docker-compose.prod.yml)
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (isStaging || env.NEXTAUTH_DEBUG === 'true') {
        log.info({ userId: user?.id, email: user?.email, provider: account?.provider }, 'signIn callback')
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (isStaging || env.NEXTAUTH_DEBUG === 'true') {
        log.info({ url, baseUrl }, 'redirect callback')
      }
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Assign the user ID from the token
        session.user.id = token.sub

        // Fetch latest user stats from database to keep session in sync
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              name: true,
              image: true,
              cuAvailable: true,
              cuLocked: true,
              rs: true,
              username: true,
              role: true,
            }
          })

          if (user) {
            // Always use DB name/image so profile edits are reflected in session
            if (user.name) session.user.name = user.name
            if (user.image) session.user.image = user.image
            session.user.cuAvailable = user.cuAvailable
            session.user.cuLocked = user.cuLocked
            session.user.username = user.username
            session.user.rs = user.rs
            session.user.role = user.role
          }
        } catch (error) {
          log.error({ err: error }, 'Error fetching user stats for session')
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        // When a user signs in, user object is available. Set token.sub to user.id
        token.sub = user.id
        token.role = user.role
      }
      return token
    },
  },
  events: {
    createUser: async ({ user }) => {
      try {
        await prisma.cuTransaction.create({
          data: {
            userId: user.id,
            type: 'INITIAL_GRANT',
            amount: 100,
            balanceAfter: 100,
            note: 'Welcome bonus',
          },
        })
      } catch (error) {
        log.error({ err: error }, 'Failed to create initial grant transaction')
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // Route NextAuth errors/warnings to our logger (helps diagnose OAuthCallback / cookie issues in prod)
  logger: {
    error(code, metadata) {
      log.error({ code, metadata: metadata ?? {} }, `NextAuth error: ${code}`)
    },
    warn(code) {
      log.warn({ code }, `NextAuth warn: ${code}`)
    },
    debug(code, metadata) {
      log.debug({ code, metadata: metadata ?? {} }, `NextAuth debug: ${code}`)
    },
  },
  // When behind nginx: use secure cookies and explicit cookie options so state/PKCE
  // cookies are set and sent on OAuth callback (avoids OAuthCallback / "state cookie missing")
  ...(isHosted && {
    useSecureCookies: true,
    cookies: {
      csrfToken: {
        name: `__Secure-next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
      callbackUrl: {
        name: `__Secure-next-auth.callback-url`,
        options: {
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
      pkceCodeVerifier: {
        name: `__Secure-next-auth.pkce.code_verifier`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
          maxAge: 900,
        },
      },
      state: {
        name: `__Secure-next-auth.state`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
          maxAge: 900,
        },
      },
      nonce: {
        name: `__Secure-next-auth.nonce`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
    },
  }),
}
