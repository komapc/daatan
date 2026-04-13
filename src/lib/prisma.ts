import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { env } from '@/env'

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

// Create Prisma client using the pg driver adapter (required by Prisma v7)
const createPrismaClient = (): PrismaClient => {
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Use cached client in development to prevent hot-reload connection exhaustion
export const prisma: PrismaClient = global.prismaClient ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  global.prismaClient = prisma
}

export default prisma
