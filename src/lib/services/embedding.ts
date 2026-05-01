import { GoogleGenerativeAI } from '@google/generative-ai'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const log = createLogger('embedding')

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIM = 768

let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  if (!_genAI) _genAI = new GoogleGenerativeAI(key)
  return _genAI
}

export async function embedText(text: string): Promise<number[] | null> {
  const genAI = getGenAI()
  if (!genAI) {
    log.warn('GEMINI_API_KEY not set — skipping embedding')
    return null
  }
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
    const result = await model.embedContent(text)
    const values = result.embedding.values
    if (values.length !== EMBEDDING_DIM) {
      log.warn({ length: values.length }, 'Unexpected embedding dimension')
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
  const vectorStr = `[${embedding.join(',')}]`
  await prisma.$executeRaw(
    Prisma.sql`UPDATE predictions SET embedding = ${Prisma.raw(`'${vectorStr}'::vector`)} WHERE id = ${id}`
  )
}
