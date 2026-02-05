# Avatar Upload Requirements

## Overview
Allow users to upload custom profile avatars, stored in AWS S3, replacing the current Google OAuth image or initials fallback.

## User Stories

### As a user
- I want to upload a custom profile picture
- I want to see a preview before saving
- I want to crop/resize my image before upload
- I want my avatar to load quickly across the site

### As a developer
- I want secure, scalable image storage (S3)
- I want automatic image optimization
- I want to prevent abuse (file size, type limits)

## Storage Architecture

### AWS S3 Setup
- **Bucket**: `daatan-avatars` (or similar)
- **Region**: Same as EC2 instance (minimize latency)
- **Access**: Private bucket with signed URLs
- **CDN**: CloudFront distribution for fast delivery
- **Lifecycle**: Keep all uploads (no auto-deletion)

### File Organization
```
s3://daatan-avatars/
  users/
    {userId}/
      avatar-{timestamp}.jpg
      avatar-{timestamp}-thumb.jpg
```

### Image Processing
- **Original**: Max 2MB, 2000x2000px
- **Display**: 400x400px (profile page)
- **Thumbnail**: 80x80px (sidebar, cards)
- **Format**: Convert to WebP for efficiency, fallback to JPEG

## Database Schema

### User Model Changes
```prisma
model User {
  // Existing
  image String? // Keep for Google OAuth fallback
  
  // New fields
  avatarUrl      String? // S3 URL for custom avatar
  avatarThumbUrl String? // S3 URL for thumbnail
  avatarUploadedAt DateTime? // Track when uploaded
}
```

## Technical Implementation

### Upload Flow
1. User selects image file (client)
2. Client-side validation (size, type)
3. Optional: Client-side crop/resize
4. Request presigned S3 URL from API
5. Upload directly to S3 from browser
6. Notify API of successful upload
7. API processes image (resize, optimize)
8. Update user record with new URLs

### API Endpoints

#### POST /api/profile/avatar/upload-url
- Generate presigned S3 upload URL
- Validate user authentication
- Return: `{ uploadUrl, key, expiresIn }`

#### POST /api/profile/avatar/confirm
- Confirm successful upload
- Trigger image processing
- Update user record
- Return: `{ avatarUrl, avatarThumbUrl }`

#### DELETE /api/profile/avatar
- Remove custom avatar
- Revert to Google OAuth image or initials
- Delete S3 objects

### Security Considerations
- **File type**: Only JPEG, PNG, WebP
- **File size**: Max 5MB upload, 2MB processed
- **Rate limiting**: Max 5 uploads per hour per user
- **Validation**: Check magic bytes, not just extension
- **Signed URLs**: 15-minute expiration
- **CORS**: Restrict to daatan.com domains

## AWS Configuration Needed

### IAM Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::daatan-avatars/users/*"
    }
  ]
}
```

### Environment Variables
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_AVATAR_BUCKET=daatan-avatars
CLOUDFRONT_DOMAIN=xxx.cloudfront.net
```

## UI/UX Flow

### Profile Edit Page
1. Show current avatar (Google or custom)
2. "Change Avatar" button
3. File picker or drag-drop
4. Crop/resize modal (optional)
5. Upload progress indicator
6. Success message + preview
7. "Remove Avatar" option

### Image Cropper
- Use library like `react-easy-crop` or `react-image-crop`
- Circular crop preview
- Zoom slider
- Rotate buttons

## Acceptance Criteria

### Must Have
1. Users can upload JPEG/PNG images
2. Images stored in S3 with proper permissions
3. Thumbnails generated automatically
4. Avatar displays across all pages (profile, sidebar, leaderboard)
5. File size and type validation
6. Secure upload (presigned URLs)

### Should Have
1. Image cropping before upload
2. CloudFront CDN for fast delivery
3. WebP format for modern browsers
4. Loading states during upload
5. Error handling (network, file size, etc.)

### Could Have
1. Avatar history (keep previous uploads)
2. Default avatar selection (preset images)
3. Gravatar integration as fallback
4. Image filters/effects

## Dependencies

### NPM Packages
- `@aws-sdk/client-s3` - S3 operations
- `@aws-sdk/s3-request-presigner` - Presigned URLs
- `sharp` - Server-side image processing
- `react-easy-crop` - Client-side cropping (optional)

### AWS Resources
- S3 bucket
- CloudFront distribution
- IAM user/role with S3 permissions

## Migration Plan

### Phase 1: Infrastructure
1. Create S3 bucket
2. Configure IAM permissions
3. Set up CloudFront (optional)
4. Add environment variables

### Phase 2: Backend
1. Add DB fields
2. Create API endpoints
3. Implement image processing
4. Add validation and security

### Phase 3: Frontend
1. Update profile edit page
2. Add upload UI
3. Implement cropper (optional)
4. Update avatar display components

### Phase 4: Testing
1. Test upload flow
2. Test image processing
3. Test across all pages
4. Load testing (concurrent uploads)

## Cost Estimation

### S3 Storage
- ~100KB per user (original + thumb)
- 1000 users = 100MB = $0.023/month
- 10,000 users = 1GB = $0.23/month

### S3 Requests
- PUT: $0.005 per 1000 requests
- GET: $0.0004 per 1000 requests
- Negligible for our scale

### CloudFront (Optional)
- First 10TB free tier
- Likely free for foreseeable future

**Total**: <$1/month for first 10,000 users

## Open Questions
1. Do we need CloudFront or is S3 direct access sufficient?
2. Should we keep upload history or only latest avatar?
3. Do we want preset avatars as an option?
4. Should we support animated GIFs?
5. What's the max file size limit? (Suggesting 5MB)

## Recommendation
**Proceed with S3 storage** - It's scalable, cost-effective, and industry standard. Start with basic upload/display, add cropping and CloudFront in later iterations.
