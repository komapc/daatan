import { execSync } from 'child_process'
import { prisma } from '@/lib/prisma'

/**
 * Ensures the test database is running and has the latest schema.
 * This should be called once before running integration tests.
 */
export async function setupTestDatabase() {
  console.log('🏗️ Setting up test database...')
  
  // 1. Start the container
  execSync('docker compose -f docker-compose.test.yml up -d postgres-test', { stdio: 'inherit' })
  
  // 2. Wait for postgres to be ready
  console.log('⏳ Waiting for postgres to be ready...')
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      execSync('docker exec daatan-postgres-test pg_isready -U daatan_test', { stdio: 'pipe' })
      ready = true
      break
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  if (!ready) {
    throw new Error('Test database failed to start')
  }

  // 3. Apply migrations
  console.log('🗄️ Applying migrations to test database...')
  // We use a different DB URL for migration
  const testDbUrl = 'postgresql://daatan_test:daatan_test@localhost:5433/daatan_test'
  execSync(`DATABASE_URL="${testDbUrl}" npx prisma migrate reset --force --skip-seed`, { stdio: 'inherit' })
  
  console.log('✅ Test database ready')
}

/**
 * Cleans up all tables in the database.
 * Use this between test cases to ensure isolation.
 */
export async function truncateDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations'
  `

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`)
      } catch (error) {
        console.log({ error })
      }
    }
  }
}

/**
 * Stops and removes the test database container.
 */
export async function teardownTestDatabase() {
  console.log('🛑 Tearing down test database...')
  execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' })
}
