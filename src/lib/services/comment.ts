import { prisma } from '@/lib/prisma'

const COMMENT_AUTHOR_SELECT = {
  id: true,
  name: true,
  username: true,
  image: true,
  rs: true,
  role: true,
} as const

const COMMENT_INCLUDE = {
  author: { select: COMMENT_AUTHOR_SELECT },
  reactions: {
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  },
  _count: { select: { replies: true } },
} as const

export interface ListCommentsQuery {
  predictionId?: string
  parentId?: string
  page: number
  limit: number
}

export async function listComments(query: ListCommentsQuery) {
  const where: Record<string, unknown> = { deletedAt: null }
  if (query.predictionId) where.predictionId = query.predictionId
  where.parentId = query.parentId ?? null

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.comment.count({ where }),
  ])

  return { comments, total }
}

export interface CreateCommentInput {
  authorId: string
  text: string
  predictionId: string
  parentId?: string
}

export async function findCommentParent(parentId: string) {
  return prisma.comment.findUnique({
    where: { id: parentId },
    select: { id: true, authorId: true, deletedAt: true },
  })
}

export async function createComment(input: CreateCommentInput) {
  return prisma.comment.create({
    data: {
      authorId: input.authorId,
      text: input.text,
      predictionId: input.predictionId,
      parentId: input.parentId,
    },
    include: COMMENT_INCLUDE,
  })
}

export async function findMentionedUsers(usernames: string[]) {
  return prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  })
}
