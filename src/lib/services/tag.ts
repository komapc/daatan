import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils/slugify'

export const listTags = async () => {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { predictions: true } },
    },
    orderBy: [
      { predictions: { _count: 'desc' } },
      { name: 'asc' },
    ],
  })
  return tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    count: tag._count.predictions,
  }))
}

export const createTag = async (name: string) => {
  const slug = slugify(name)

  const existing = await prisma.tag.findUnique({ where: { slug } })
  if (existing) {
    return { ok: false as const, error: 'Tag with this name already exists', status: 409 }
  }

  const tag = await prisma.tag.create({ data: { name: name.trim(), slug } })
  return {
    ok: true as const,
    data: { id: tag.id, name: tag.name, slug: tag.slug },
    status: 201,
  }
}
