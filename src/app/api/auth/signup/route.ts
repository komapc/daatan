import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validations/auth'
import { apiError, handleRouteError } from '@/lib/api-error'
import { slugify } from '@/lib/utils/slugify'
import { createLogger } from '@/lib/logger'

const log = createLogger('api-auth-signup')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = registerSchema.parse(body)
    const { name, email, password } = validatedData

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return apiError('User with this email already exists', 400)
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // 3. Generate unique username and slug
    const baseUsername = slugify(name).replace(/-/g, '_')
    const baseSlug = slugify(name)
    
    // Find collisions
    const collisions = await prisma.user.findMany({
      where: {
        OR: [
          { username: { startsWith: baseUsername } },
          { slug: { startsWith: baseSlug } }
        ]
      },
      select: { username: true, slug: true }
    })

    const existingUsernames = collisions.map(c => c.username).filter((u): u is string => !!u)
    const existingSlugs = collisions.map(c => c.slug).filter((s): s is string => !!s)

    let username = baseUsername
    let slug = baseSlug
    let counter = 1

    while (existingUsernames.includes(username)) {
      username = `${baseUsername}${counter}`
      counter++
    }

    counter = 1
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // 4. Create user and initial grant in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          username,
          slug,
          cuAvailable: 100, // Initial grant
        },
      })

      await tx.cuTransaction.create({
        data: {
          userId: user.id,
          type: 'INITIAL_GRANT',
          amount: 100,
          balanceAfter: 100,
          note: 'Welcome bonus',
        },
      })

      return user
    })

    log.info({ userId: newUser.id, email: newUser.email }, 'User registered successfully')

    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
    }, { status: 201 })

  } catch (error) {
    return handleRouteError(error, 'Failed to register user')
  }
}
