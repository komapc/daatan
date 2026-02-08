import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
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
        // Assign the user ID from the token
        session.user.id = token.sub
        
        // Fetch latest user stats from database to keep session in sync
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              cuAvailable: true,
              cuLocked: true,
              rs: true,
              username: true,
              isAdmin: true,
              isModerator: true,
            }
          })
          
          if (user) {
            session.user.cuAvailable = user.cuAvailable
            session.user.cuLocked = user.cuLocked
            session.user.username = user.username
            session.user.rs = user.rs
            session.user.isAdmin = user.isAdmin
            session.user.isModerator = user.isModerator
          }
        } catch (error) {
          console.error('Error fetching user stats for session:', error)
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        // When a user signs in, user object is available. Set token.sub to user.id
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
            amount: 100,
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
