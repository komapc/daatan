import { prisma } from './src/lib/prisma'

async function main() {
  const p = await prisma.prediction.findFirst({
    where: {
      OR: [
        { claimText: { contains: "Trump" } },
        { slug: { contains: "trump" } }
      ]
    },
    select: { id: true, slug: true, claimText: true }
  })
  console.log('Prediction:', p)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
