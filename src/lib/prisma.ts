import { PrismaClient } from '@prisma/client'
import { env } from '@/env'

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

// Create Prisma client (using standard native driver)
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Use cached client in development to prevent hot-reload connection exhaustion
export const prisma: PrismaClient = global.prismaClient ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  global.prismaClient = prisma
}

export default prisma
