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
