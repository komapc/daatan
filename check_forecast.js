const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const predictions = await prisma.prediction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    })
    console.log(JSON.stringify(predictions, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
