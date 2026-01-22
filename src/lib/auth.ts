import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma' // Make sure this path is correct

export const authOptions: NextAuthOptions = {
  // @ts-ignore
  adapter: PrismaAdapter(prisma), // Add the Prisma adapter here
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
      if (session.user) {
        // Assign the user ID from the token (which comes from the database)
        session.user.id = token.sub
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
