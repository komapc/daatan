import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

// Create Prisma client (using standard native driver)
const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Use cached client in development to prevent hot-reload connection exhaustion
export const prisma: PrismaClient = global.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma
}

export default prisma
