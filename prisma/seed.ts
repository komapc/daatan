import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmails = [
    'komapc@gmail.com',
    'andrey1bar@gmail.com'
  ]

  console.log('Start seeding admins...')

  for (const email of adminEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN', isAdmin: true, isModerator: true },
      create: {
        email,
        name: 'Admin User',
        role: 'ADMIN',
        isAdmin: true,
        isModerator: true,
        username: email.split('@')[0], // Fallback username
      },
    })
    console.log(`Updated user ${user.email} to ADMIN role`)
  }

  console.log('Seeding predictions...')
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

  if (admin) {
    const predictions = [
      {
        claimText: "Bitcoin will reach $100k by end of 2026",
        slug: "btc-100k-2026",
        detailsText: "Prediction based on current market trends and halving cycles.",
        domain: "crypto",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-12-31T23:59:59Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "SpaceX Starship successfully orbits Earth in next launch",
        slug: "spacex-starship-orbit-next",
        detailsText: "Success defined as completing at least one full orbit and splashing down.",
        domain: "space",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-06-30T12:00:00Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "GPT-5 released before Q3 2026",
        slug: "gpt-5-release-q3-2026",
        domain: "ai",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-09-30T23:59:59Z"),
        status: 'DRAFT',
        publishedAt: null,
      }
    ]

    for (const p of predictions) {
      await prisma.prediction.upsert({
        where: { slug: p.slug },
        update: {},
        create: {
          ...p,
          outcomeType: p.outcomeType as any,
          status: p.status as any,
          authorId: admin.id
        }
      })
      console.log(`Upserted prediction: ${p.slug}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
