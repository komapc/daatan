
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding predictions (JS)...')

    // Find admin
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

    if (!admin) {
        console.log('No admin found, skipping.')
        return
    }

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
        const existing = await prisma.prediction.findUnique({
            where: { slug: p.slug }
        })

        if (!existing) {
            await prisma.prediction.create({
                data: {
                    ...p,
                    authorId: admin.id
                }
            })
            console.log(`Created prediction: ${p.slug}`)
        } else {
            console.log(`Prediction exists: ${p.slug}`)
        }
    }
    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
