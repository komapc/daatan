import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import IbiTool from '@/components/ibi/IbiTool'

export const metadata = { title: 'IBI Retro Analysis' }

export default async function IbiPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/ibi')
  if (session.user.role !== 'ADMIN') redirect('/')
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <IbiTool />
    </main>
  )
}
