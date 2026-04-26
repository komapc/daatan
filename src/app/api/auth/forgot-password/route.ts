import { NextRequest, NextResponse } from 'next/server'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import { createVerificationToken, sendPasswordResetEmail } from '@/lib/services/auth-email'
import { findUserByEmail } from '@/lib/services/user'
import { createLogger } from '@/lib/logger'

const log = createLogger('forgot-password')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = forgotPasswordSchema.parse(body)

    const user = await findUserByEmail(email)

    // Always respond 200 to avoid email enumeration
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const token = await createVerificationToken(email, 'reset', 60 * 60 * 1000) // 1h
    await sendPasswordResetEmail(email, token)
    log.info({ email }, 'Password reset email sent')

    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'forgot-password error')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
