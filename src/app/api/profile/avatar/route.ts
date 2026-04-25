import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError, apiError } from '@/lib/api-error'
import { updateAvatar } from '@/lib/services/user'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const log = createLogger('avatar-upload')

// Configure S3 client
const REGION = process.env.AWS_REGION || 'eu-central-1'
const s3Client = new S3Client({ region: REGION })

// Get bucket name from environment. If not set, fallback to a constructed name based on APP_ENV
function getUploadsBucket(): string | null {
  if (process.env.UPLOADS_BUCKET_NAME) return process.env.UPLOADS_BUCKET_NAME
  
  // Try to construct it based on Terraform conventions
  const env = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'staging'
  const mappedEnv = env === 'next' ? 'staging' : env
  const accountId = process.env.AWS_ACCOUNT_ID
  
  if (accountId) {
    return `daatan-uploads-${mappedEnv}-${accountId}`
  }
  
  return null
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const bucket = getUploadsBucket()
    if (!bucket) {
      log.error('S3 uploads bucket name is not configured (missing UPLOADS_BUCKET_NAME or AWS_ACCOUNT_ID)')
      return apiError('Server configuration error', 500)
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return apiError('No file provided', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError('File must be less than 5MB', 400)
    }

    if (!file.type.startsWith('image/')) {
      return apiError('File must be an image', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Process image with sharp: 256x256, cover, WebP format
    const processedImage = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    // Generate unique filename
    const hash = crypto.createHash('sha256').update(user.id + Date.now().toString()).digest('hex').substring(0, 16)
    const key = `avatars/${user.id}/${hash}.webp`

    log.debug({ userId: user.id, key }, 'Uploading avatar to S3')

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: processedImage,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000', // 1 year cache
    }))

    // Construct the public URL
    const avatarUrl = `https://${bucket}.s3.${REGION}.amazonaws.com/${key}`

    // Update database
    await updateAvatar(user.id, avatarUrl)

    log.info({ userId: user.id, avatarUrl }, 'Avatar updated successfully')

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    return handleRouteError(error, 'Failed to upload avatar')
  }
})
