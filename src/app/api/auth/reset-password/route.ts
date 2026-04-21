import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resetPasswordSchema } from '@/lib/validations/auth'
import { deleteVerificationToken } from '@/lib/services/auth-email'
import { createLogger } from '@/lib/logger'

const log = createLogger('reset-password')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, token, password } = resetPasswordSchema.parse(body)

    const identifier = `reset:${email}`
    const record = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    })

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { email }, data: { password: hashed } })
    await deleteVerificationToken(identifier, token)

    log.info({ email }, 'Password reset successful')
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'reset-password error')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
