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
        session.user.id = token.sub

        if (token.userDeleted) {
          log.warn({ userId: token.sub }, 'Session user not found in DB — invalidating session')
          session.expires = new Date(0).toISOString()
          return session
        }

        // Read cached values from JWT — no DB round-trip needed
        session.user.role = token.role ?? 'USER'
        session.user.username = token.username
        session.user.rs = token.rs
        session.user.cuAvailable = token.cuAvailable
        session.user.cuLocked = token.cuLocked
        if (token.name) session.user.name = token.name
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
    async jwt({ token, user }) {
      // On sign-in the `user` object is present; otherwise only refresh when cache is stale
      const TTL = 5 * 60 * 1000 // 5 minutes
      const isSignIn = !!user
      const stale = !token.cachedAt || Date.now() - token.cachedAt > TTL

      if ((isSignIn || stale) && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, username: true, name: true, image: true, rs: true, cuAvailable: true, cuLocked: true },
          })

          if (!dbUser) {
            token.userDeleted = true
            return token
          }

          token.role = dbUser.role
          token.username = dbUser.username
          token.name = dbUser.name ?? token.name
          token.picture = dbUser.image ?? token.picture
          token.rs = dbUser.rs
          token.cuAvailable = dbUser.cuAvailable
          token.cuLocked = dbUser.cuLocked
          token.cachedAt = Date.now()
          token.userDeleted = undefined
        } catch (error) {
          log.error({ err: error }, 'Error fetching user for JWT cache')
        }
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
