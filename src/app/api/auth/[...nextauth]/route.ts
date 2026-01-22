import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import type { NextAuthOptions } from 'next-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Lazy singleton for prisma - only created on first request
let prismaInstance: import('@prisma/client').PrismaClient | null = null

const getPrisma = async () => {
  if (!prismaInstance) {
    const { PrismaClient } = await import('@prisma/client')
    prismaInstance = new PrismaClient()
  }
  return prismaInstance
}

const createAuthOptions = async (): Promise<NextAuthOptions> => {
  const prisma = await getPrisma()
  
  return {
    adapter: PrismaAdapter(prisma),
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }),
    ],
    session: {
      strategy: 'jwt',
    },
    callbacks: {
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { username: true, isAdmin: true, brierScore: true, cuAvailable: true, cuLocked: true },
          })
          if (dbUser) {
            session.user.username = dbUser.username
            session.user.isAdmin = dbUser.isAdmin
            session.user.brierScore = dbUser.brierScore
            session.user.cuAvailable = dbUser.cuAvailable
            session.user.cuLocked = dbUser.cuLocked
          }
        }
        return session
      },
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id
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
              amount: 100, // Default starting amount
              balanceAfter: 100,
              note: 'Welcome bonus',
            },
          })
        } catch (error) {
          console.error('Failed to create initial grant transaction:', error)
        }
      },
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },
  }
}

// Cache the handler after first creation
let cachedHandler: ReturnType<typeof NextAuth> | null = null

const getHandler = async () => {
  if (!cachedHandler) {
    const authOptions = await createAuthOptions()
    cachedHandler = NextAuth(authOptions)
  }
  return cachedHandler
}

export async function GET(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const handler = await getHandler()
  return handler(request, context)
}

export async function POST(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const handler = await getHandler()
  return handler(request, context)
}
