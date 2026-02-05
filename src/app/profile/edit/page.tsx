import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileEditForm from '@/components/profile/ProfileEditForm'

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/profile/edit')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      username: true,
      website: true,
      twitterHandle: true,
      emailNotifications: true,
    }
  })

  if (!user) {
    redirect('/')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Edit Profile</h1>
        <p className="text-gray-500">Update your profile information and preferences</p>
      </div>

      <ProfileEditForm user={user} />
    </div>
  )
}
