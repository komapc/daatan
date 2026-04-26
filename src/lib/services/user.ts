import { prisma } from '@/lib/prisma'

export interface UpdateProfileData {
  name?: string | null
  username?: string | null
  website?: string | null
  twitterHandle?: string | null
  emailNotifications?: boolean
}

export const updateProfile = async (userId: string, data: UpdateProfileData) => {
  if (data.username) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } })
    if (existing && existing.id !== userId) {
      return { ok: false as const, error: 'Username already taken', status: 400 }
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name ?? null,
      username: data.username ?? null,
      website: data.website ?? null,
      twitterHandle: data.twitterHandle ?? null,
      emailNotifications: data.emailNotifications,
    },
    select: {
      id: true,
      name: true,
      username: true,
      website: true,
      twitterHandle: true,
      emailNotifications: true,
    },
  })

  return { ok: true as const, data: updated, status: 200 }
}

export const updateAvatar = async (userId: string, avatarUrl: string) => {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } })
}

export const updateLanguage = async (userId: string, language: string) => {
  await prisma.user.update({ where: { id: userId }, data: { preferredLanguage: language } })
}

export const deleteAccount = async (userId: string) => {
  await prisma.user.delete({ where: { id: userId } })
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

export async function findUserBasicInfo(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { name: true, username: true } })
}

export async function findUsernameCollisions(baseUsername: string, baseSlug: string) {
  return prisma.user.findMany({
    where: {
      OR: [
        { username: { startsWith: baseUsername } },
        { slug: { startsWith: baseSlug } },
      ],
    },
    select: { username: true, slug: true },
  })
}

export interface RegisterUserData {
  name: string
  email: string
  hashedPassword: string
  username: string
  slug: string
}

export async function registerUser(data: RegisterUserData) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.hashedPassword,
        username: data.username,
        slug: data.slug,
        cuAvailable: 100,
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
}

export async function grantCuToAllUsers(amount: number, note: string) {
  const users = await prisma.user.findMany({
    where: { isBot: false },
    select: { id: true, cuAvailable: true },
  })

  if (users.length === 0) return 0

  await prisma.$transaction(
    users.flatMap(u => [
      prisma.cuTransaction.create({
        data: {
          userId: u.id,
          type: 'ADMIN_ADJUSTMENT',
          amount,
          balanceAfter: u.cuAvailable + amount,
          note,
        },
      }),
      prisma.user.update({
        where: { id: u.id },
        data: { cuAvailable: { increment: amount } },
      }),
    ]),
  )

  return users.length
}

export interface AdminUsersQuery {
  search?: string
  page: number
  limit: number
}

export async function listAdminUsers({ search, page, limit }: AdminUsersQuery) {
  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        cuAvailable: true, rs: true, createdAt: true,
        _count: { select: { predictions: true, commitments: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total, pages: Math.ceil(total / limit) }
}

export async function updateUserRole(id: string, role: string) {
  return prisma.user.update({
    where: { id },
    data: { role: role as 'USER' | 'RESOLVER' | 'ADMIN' },
    select: {
      id: true, name: true, username: true, emailNotifications: true,
      isPublic: true, role: true, rs: true, cuAvailable: true, isBot: true,
    },
  })
}
