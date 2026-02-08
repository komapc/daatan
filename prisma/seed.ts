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

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
