/**
 * One-time script: grant 100 CU to users.
 *
 * By default targets only users currently at 0.
 * Set ALL_USERS=true to grant to every non-bot user regardless of balance.
 *
 * Usage (local against staging DB):
 *   DATABASE_URL="..." tsx scripts/grant-initial-cu.ts
 *
 * Usage (all users, e.g. staging bonus):
 *   ALL_USERS=true DATABASE_URL="..." tsx scripts/grant-initial-cu.ts
 *
 * Usage (dry-run, no writes):
 *   DRY_RUN=true DATABASE_URL="..." tsx scripts/grant-initial-cu.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const GRANT_AMOUNT = 100
const DRY_RUN = process.env.DRY_RUN === 'true'
const ALL_USERS = process.env.ALL_USERS === 'true'

async function main() {
  const where = ALL_USERS ? { isBot: false } : { cuAvailable: 0, isBot: false }
  const targets = await prisma.user.findMany({
    where,
    select: { id: true, name: true, username: true, cuAvailable: true },
  })

  const scope = ALL_USERS ? 'all users' : 'users with 0 CU'
  console.log(`Found ${targets.length} ${scope}${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`)

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
          note: ALL_USERS ? 'CU grant — 100 CU to all users' : 'Initial CU grant for existing users',
          balanceAfter: user.cuAvailable + GRANT_AMOUNT,
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
