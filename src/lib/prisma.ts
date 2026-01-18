import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL

// Create Prisma client with pg adapter (required for Prisma 7)
const createPrismaClient = (): PrismaClient => {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({ adapter })
}

// Use cached client in development to prevent hot-reload connection exhaustion
export const prisma: PrismaClient = global.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma
}

export default prisma
