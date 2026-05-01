/**
 * One-time backfill: embed all predictions that have no embedding yet.
 * Run with: npx tsx scripts/backfill-embeddings.ts
 *
 * Requires GEMINI_API_KEY and DATABASE_URL in environment.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { GoogleGenerativeAI } from '@google/generative-ai'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const EMBEDDING_MODEL = 'text-embedding-004'
const BATCH_SIZE = 20
const DELAY_MS = 500 // stay well under quota

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is required')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter } as any)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const total = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) FROM predictions WHERE embedding IS NULL
  `
  const count = Number(total[0].count)
  console.log(`Found ${count} predictions without embeddings`)

  let processed = 0
  const failedIds = new Set<string>()

  while (true) {
    // Re-query each iteration — successfully embedded rows drop out of
    // WHERE embedding IS NULL, so LIMIT alone walks through all unprocessed rows.
    const rows = await prisma.$queryRaw<{ id: string; claimText: string }[]>`
      SELECT id, "claimText" FROM predictions
      WHERE embedding IS NULL
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE}
    `

    // Only rows in failedIds remain unprocessed — stop to avoid an infinite loop
    if (rows.length === 0 || rows.every(r => failedIds.has(r.id))) break

    for (const row of rows) {
      if (failedIds.has(row.id)) continue
      try {
        const result = await model.embedContent(row.claimText)
        const vectorStr = `[${result.embedding.values.join(',')}]`
        await prisma.$executeRaw(
          Prisma.sql`UPDATE predictions SET embedding = ${Prisma.raw(`'${vectorStr}'::vector`)} WHERE id = ${row.id}`
        )
        processed++
        if (processed % 10 === 0) console.log(`  ${processed}/${count} done`)
      } catch (err) {
        console.error(`  Failed ${row.id}: ${err}`)
        failedIds.add(row.id)
      }
    }

    if (rows.length === BATCH_SIZE) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`Done. Processed: ${processed}, Failed: ${failedIds.size}`)
  if (failedIds.size > 0) console.log('Failed IDs:', [...failedIds].join(', '))

  await prisma.$disconnect()
  await pool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
