import { createLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const log = createLogger('embedding')

const EMBEDDING_MODEL = 'gemini-embedding-2'
const EMBEDDING_DIM = 768

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    log.warn('GEMINI_API_KEY not set — skipping embedding')
    return null
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIM,
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      log.error({ status: res.status, body }, 'Gemini embedding API error')
      return null
    }
    const data = (await res.json()) as { embedding?: { values: number[] } }
    const values = data.embedding?.values
    if (!values || values.length !== EMBEDDING_DIM) {
      log.warn({ length: values?.length }, 'Unexpected embedding dimension')
      return null
    }
    return values
  } catch (err) {
    log.error({ err }, 'Failed to embed text')
    return null
  }
}

export async function embedAndStoreForecast(id: string, claimText: string): Promise<void> {
  const embedding = await embedText(claimText)
  if (!embedding) return
  if (!embedding.every(Number.isFinite)) {
    log.warn({ id }, 'Embedding contains non-finite values — skipping store')
    return
  }
  const vectorStr = `[${embedding.join(',')}]`
  await prisma.$executeRaw(
    Prisma.sql`UPDATE predictions SET embedding = ${Prisma.raw(`'${vectorStr}'::vector`)} WHERE id = ${id}`
  )
}
