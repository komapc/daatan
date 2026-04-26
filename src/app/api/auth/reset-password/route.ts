import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { resetPasswordSchema } from '@/lib/validations/auth'
import { resetUserPassword } from '@/lib/services/auth-email'
import { createLogger } from '@/lib/logger'

const log = createLogger('reset-password')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, token, password } = resetPasswordSchema.parse(body)

    const hashed = await bcrypt.hash(password, 12)
    const ok = await resetUserPassword(email, token, hashed)

    if (!ok) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    log.info({ email }, 'Password reset successful')
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'reset-password error')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
