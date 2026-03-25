import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import CreateForecastClient from './CreateForecastClient'

export const dynamic = 'force-dynamic'

export default async function CreatePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/create')
  }

  return <CreateForecastClient userId={session.user.id} />
}
