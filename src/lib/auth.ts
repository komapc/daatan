import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { validateOAuthEnv, maskSecret } from '@/lib/validations/env'

const log = createLogger('auth')

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ''
const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'

// Validate OAuth credentials format at startup (server-side only)
if (typeof window === 'undefined') {
  const envValidation = validateOAuthEnv()
  if (!envValidation.valid) {
    log.error(
      {
        errors: envValidation.errors,
        clientIdPreview: googleClientId ? `${googleClientId.slice(0, 8)}...` : '(empty)',
        secretPreview: maskSecret(googleClientSecret),
        nextAuthUrl: process.env.NEXTAUTH_URL ?? '(empty)',
      },
      'Google OAuth misconfigured — auth will fail. Fix these issues:\n' +
      envValidation.errors.map(e => `  - ${e}`).join('\n') +
      '\nFor staging, also ensure https://staging.daatan.com/api/auth/callback/google is in your Google OAuth client\'s Authorized redirect URIs.'
    )
  } else {
    log.info(
      { clientIdPrefix: googleClientId.slice(0, 8), nextAuthUrl: process.env.NEXTAUTH_URL },
      'Google OAuth credentials validated successfully'
    )
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
  debug: isStaging || process.env.NEXTAUTH_DEBUG === 'true',
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (isStaging) {
        log.debug({ userId: user?.id, email: user?.email, provider: account?.provider }, 'signIn callback')
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (isStaging) {
        log.debug({ url, baseUrl }, 'redirect callback')
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
  // Explicit cookie options for staging behind nginx - ensures PKCE/state cookies
  // are set with correct domain/path so they're sent when Google redirects back
  ...(isStaging && {
    cookies: {
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
    },
  }),
}
