import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const log = createLogger('unread-count')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 })
    }

    const count = await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch unread count')
    return NextResponse.json({ count: 0 })
  }
}
