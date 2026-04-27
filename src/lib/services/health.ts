import { prisma } from '@/lib/prisma'

/** Ping the database. Returns true if reachable, false otherwise. */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
