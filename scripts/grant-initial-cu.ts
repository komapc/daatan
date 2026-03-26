/**
 * One-time script: grant 100 CU to all users currently at 0.
 *
 * Usage (local against prod DB):
 *   DATABASE_URL="..." tsx scripts/grant-initial-cu.ts
 *
 * Usage (dry-run, no writes):
 *   DRY_RUN=true DATABASE_URL="..." tsx scripts/grant-initial-cu.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const GRANT_AMOUNT = 100
const DRY_RUN = process.env.DRY_RUN === 'true'

async function main() {
  const targets = await prisma.user.findMany({
    where: { cuAvailable: 0, isBot: false },
    select: { id: true, name: true, username: true, cuAvailable: true },
  })

  console.log(`Found ${targets.length} users with 0 CU${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`)

  if (targets.length === 0 || DRY_RUN) {
    targets.forEach((u) => console.log(`  ${u.username ?? u.id} (${u.name})`))
    return
  }

  let granted = 0
  for (const user of targets) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { cuAvailable: { increment: GRANT_AMOUNT } },
      }),
      prisma.cuTransaction.create({
        data: {
          userId: user.id,
          amount: GRANT_AMOUNT,
          type: 'INITIAL_GRANT',
          note: 'Initial CU grant for existing users',
        },
      }),
    ])
    granted++
    console.log(`  ✓ ${user.username ?? user.id} — +${GRANT_AMOUNT} CU`)
  }

  console.log(`\nDone. Granted ${GRANT_AMOUNT} CU to ${granted} users.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
