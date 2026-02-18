import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Standard tags used across the application for categorizing predictions.
 * These tags are seeded to the database and used by the LLM for auto-tagging.
 */
const STANDARD_TAGS = [
  'Politics',
  'Geopolitics',
  'Economy',
  'Technology',
  'AI',
  'Crypto',
  'Sports',
  'Entertainment',
  'Science',
  'Climate',
  'Health',
  'Business',
  'Conflict',
  'Elections',
  'US Politics',
  'Europe',
  'Middle East',
  'Asia',
  'Energy',
  'Space',
]

/**
 * Simple slugify function for seed script.
 * Converts text to URL-friendly slugs.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  console.log('🌱 Seeding standard tags...')

  let created = 0
  let skipped = 0

  for (const tagName of STANDARD_TAGS) {
    const slug = slugify(tagName)

    try {
      await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: {
          name: tagName,
          slug,
        },
      })
      created++
      console.log(`  ✓ ${tagName}`)
    } catch (error) {
      skipped++
      console.error(`  ✗ ${tagName}: ${(error as Error).message}`)
    }
  }

  console.log(`\n✅ Seeding complete: ${created} tags created, ${skipped} skipped`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
